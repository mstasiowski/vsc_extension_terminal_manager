import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

//info Mapa przechowująca aktywne terminale (nazwa => obiekt terminala)
let terminalMap: Map<string, vscode.Terminal> = new Map();

//info Mapa przechowująca watchers dla plików
let fileWatchers: Map<string, vscode.FileSystemWatcher> = new Map();

//info Funkcja pomocnicza do pobierania aktualnej konfiguracji
function getCurrentConfig() {
  const config = vscode.workspace.getConfiguration("terminalManager");
  return {
    terminals: config.get<any[]>("terminals") || [],
    groups: config.get<{ [key: string]: string[] }>("groups") || {},
    scriptModules: config.get<any[]>("scriptModules") || [],
  };
}

//info Funkcja aktywująca rozszerzenie
export function activate(context: vscode.ExtensionContext) {
  //info Funkcja pomocnicza: uruchom terminal i dodaj go do mapy
  async function startTerminal(
    name: string,
    commands: string[] | undefined,
    location?: string
  ) {
    if (terminalMap.has(name)) {
      vscode.window.showInformationMessage(`Terminal "${name}" już działa.`);
      return;
    }

    let commandsToRun: string[] = [];

    if (commands && commands.length > 0) {
      commandsToRun = commands;
    } else if (location) {
      try {
        // Oblicz ścieżkę bezwzględną względem katalogu workspace
        const workspaceFolders = vscode.workspace.workspaceFolders;
        let fullPath = location;
        if (
          workspaceFolders &&
          workspaceFolders.length > 0 &&
          !path.isAbsolute(location)
        ) {
          fullPath = path.join(workspaceFolders[0].uri.fsPath, location);
        }

        const fileContent = fs.readFileSync(fullPath, "utf8");
        const json = JSON.parse(fileContent);

        if (Array.isArray(json.commands)) {
          if (json.commands.every((cmd: any) => typeof cmd === "string")) {
            commandsToRun = json.commands;
          } else {
            vscode.window.showErrorMessage(
              `Plik ${fullPath} zawiera nieprawidłową tablicę "commands". Oczekiwano tablicy stringów.`
            );
            return;
          }
        } else {
          vscode.window.showErrorMessage(
            `Plik ${fullPath} nie zawiera tablicy "commands".`
          );
          return;
        }
      } catch (error) {
        let errorMessage = "Nieznany błąd";
        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (typeof error === "string") {
          errorMessage = error;
        }
        vscode.window.showErrorMessage(
          `Błąd wczytywania komend z pliku: ${errorMessage}`
        );
        return;
      }
    } else {
      vscode.window.showWarningMessage(
        `Terminal "${name}" nie ma zdefiniowanych komend ani lokalizacji.`
      );
      return;
    }

    const term = vscode.window.createTerminal(name);
    terminalMap.set(name, term);
    term.show();

    for (const cmd of commandsToRun) {
      term.sendText(cmd);
    }

    // Dodaj watcher dla pliku jeśli location jest określone
    if (location) {
      watchFile(location, name);
    }
  }

  //info Funkcja do obserwowania pliku
  function watchFile(location: string, terminalName: string) {
    // Oblicz ścieżkę absolutną
    const workspaceFolders = vscode.workspace.workspaceFolders;
    let fullPath = location;
    if (
      workspaceFolders &&
      workspaceFolders.length > 0 &&
      !path.isAbsolute(location)
    ) {
      fullPath = path.join(workspaceFolders[0].uri.fsPath, location);
    }

    // Jeśli watcher już istnieje dla tego pliku, usuń go
    if (fileWatchers.has(fullPath)) {
      fileWatchers.get(fullPath)?.dispose();
    }

    const watcher = vscode.workspace.createFileSystemWatcher(fullPath);

    watcher.onDidChange(() => {
      vscode.window.showInformationMessage(
        `Plik komend ${terminalName} (${fullPath}) zmieniony, restartuję terminal...`
      );

      // Zatrzymaj terminal i uruchom ponownie
      const term = terminalMap.get(terminalName);
      if (term) {
        term.dispose();
        terminalMap.delete(terminalName);
      }

      // Załaduj nową konfigurację komend i uruchom terminal ponownie
      startTerminal(terminalName, undefined, location);
    });

    watcher.onDidDelete(() => {
      vscode.window.showWarningMessage(
        `Plik ${fullPath} został usunięty, zatrzymuję terminal ${terminalName}`
      );
      const term = terminalMap.get(terminalName);
      if (term) {
        term.dispose();
        terminalMap.delete(terminalName);
      }
      // Usuń watcher po usunięciu pliku
      fileWatchers.delete(fullPath);
    });

    // Dodaj watcher do mapy i context subscriptions
    fileWatchers.set(fullPath, watcher);
    context.subscriptions.push(watcher);
  }

  //info Funkcja pomocnicza do uruchamiania pojedynczego skryptu w module
  async function runScriptInModule(
    moduleName: string,
    location: string,
    script: string,
    extraFlags: string = ""
  ) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showErrorMessage("Brak otwartego folderu roboczego.");
      return;
    }

    const modulePath = path.isAbsolute(location)
      ? location
      : path.join(workspaceFolder.uri.fsPath, location);
    const packageJsonPath = path.join(modulePath, "package.json");

    // Sprawdź czy package.json istnieje i czy zawiera wymagany skrypt
    try {
      const fileContent = fs.readFileSync(packageJsonPath, "utf8");
      const pkg = JSON.parse(fileContent);

      if (!pkg.scripts || typeof pkg.scripts !== "object") {
        vscode.window.showErrorMessage(
          `Brak sekcji "scripts" w ${packageJsonPath}`
        );
        return;
      }

      if (!(script in pkg.scripts)) {
        vscode.window.showWarningMessage(
          `Skrypt "${script}" nie istnieje w ${moduleName} (${packageJsonPath})`
        );
        return;
      }
    } catch (err) {
      vscode.window.showErrorMessage(
        `Błąd wczytywania package.json dla ${moduleName}: ${
          (err as Error).message
        }`
      );
      return;
    }

    // Tworzenie unikalnej nazwy terminala
    const termName = `${moduleName} - ${script}`;

    if (terminalMap.has(termName)) {
      vscode.window.showInformationMessage(
        `Terminal "${termName}" już działa.`
      );
      return;
    }

    const term = vscode.window.createTerminal({
      name: termName,
      cwd: modulePath,
    });

    terminalMap.set(termName, term);
    term.show();

    // Skonstruuj komendę z opcjonalnymi flagami
    const finalCommand = `npm run ${script} ${extraFlags}`.trim();
    term.sendText(finalCommand);

    const disposable = vscode.window.onDidCloseTerminal((closedTerminal) => {
      if (closedTerminal === term) {
        terminalMap.delete(termName);
        disposable.dispose();
      }
    });

    context.subscriptions.push(disposable);
  }

  //info Komenda: uruchom wszystkie terminale z autoStart = true
  context.subscriptions.push(
    vscode.commands.registerCommand("terminalManager.startAll", () => {
      const { terminals } = getCurrentConfig(); // Pobierz aktualną konfigurację
      terminals.forEach((term) => {
        if (term.autoStart) {
          startTerminal(term.name, term.commands, term.location);
        }
      });
    })
  );

  //info Komenda: uruchom wybrane terminale z listy
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "terminalManager.startSelected",
      async () => {
        const { terminals } = getCurrentConfig(); // Pobierz aktualną konfigurację
        const selection = await vscode.window.showQuickPick(
          terminals.map((t) => ({
            label: t.name,
            description: (t.commands || []).join("; "), // Zabezpieczenie przed undefined
          })),
          {
            canPickMany: true,
            placeHolder: "Wybierz terminale do uruchomienia",
          }
        );

        if (!selection || selection.length === 0) {
          vscode.window.showInformationMessage(
            "Nie wybrano żadnych terminali."
          );
          return;
        }

        selection.forEach((item) => {
          const terminalConfig = terminals.find((t) => t.name === item.label);
          if (terminalConfig) {
            startTerminal(
              terminalConfig.name,
              terminalConfig.commands,
              terminalConfig.location
            );
          }
        });
      }
    )
  );

  //info Komenda: zatrzymaj wybrane terminale z listy aktywnych
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "terminalManager.stopSelected",
      async () => {
        const openNames = Array.from(terminalMap.keys());

        if (openNames.length === 0) {
          vscode.window.showInformationMessage("Brak otwartych terminali.");
          return;
        }

        const selection = await vscode.window.showQuickPick(openNames, {
          canPickMany: true,
          placeHolder: "Wybierz terminale do zatrzymania",
        });

        if (!selection || selection.length === 0) {
          vscode.window.showInformationMessage(
            "Nie wybrano żadnych terminali."
          );
          return;
        }

        selection.forEach((name) => {
          const term = terminalMap.get(name);
          if (term) {
            term.dispose();
            terminalMap.delete(name);
          }
        });
      }
    )
  );

  //info Komenda: zatrzymaj wszystkie uruchomione terminale
  context.subscriptions.push(
    vscode.commands.registerCommand("terminalManager.stopAll", () => {
      terminalMap.forEach((term) => term.dispose());
      terminalMap.clear();

      fileWatchers.forEach((watcher) => watcher.dispose());
      fileWatchers.clear();
    })
  );

  //info Komenda: uruchom pojedynczy terminal z listy
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "terminalManager.startTerminal",
      async () => {
        const { terminals } = getCurrentConfig(); // Pobierz aktualną konfigurację
        const choices = terminals.map((t) => t.name);
        const pick = await vscode.window.showQuickPick(choices, {
          placeHolder: "Wybierz terminal do uruchomienia",
        });
        const term = terminals.find((t) => t.name === pick);
        if (term) {
          startTerminal(term.name, term.commands, term.location);
        }
      }
    )
  );

  //info Komenda: zatrzymaj pojedynczy terminal z aktywnych
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "terminalManager.stopTerminal",
      async () => {
        const choices = Array.from(terminalMap.keys());
        const pick = await vscode.window.showQuickPick(choices, {
          placeHolder: "Wybierz terminal do zatrzymania",
        });
        if (pick) {
          const term = terminalMap.get(pick);
          if (term) {
            term.dispose();
            terminalMap.delete(pick);
          }
        }
      }
    )
  );

  //info Komenda: uruchom grupę terminali (zdefiniowaną w settings.json)
  context.subscriptions.push(
    vscode.commands.registerCommand("terminalManager.startGroup", async () => {
      const { terminals, groups } = getCurrentConfig(); // Pobierz aktualną konfigurację
      const groupNames = Object.keys(groups);

      if (groupNames.length === 0) {
        vscode.window.showWarningMessage("Brak zdefiniowanych grup terminali.");
        return;
      }

      const selectedGroup = await vscode.window.showQuickPick(groupNames, {
        placeHolder: "Wybierz grupę terminali do uruchomienia",
      });

      if (!selectedGroup) return;

      const terminalNames = groups[selectedGroup];

      terminalNames.forEach((name) => {
        const terminalConfig = terminals.find((t) => t.name === name);
        if (terminalConfig) {
          startTerminal(
            terminalConfig.name,
            terminalConfig.commands,
            terminalConfig.location
          );
        } else {
          vscode.window.showErrorMessage(`Nie znaleziono terminala: ${name}`);
        }
      });
    })
  );

  //info Komenda: zatrzymaj wszystkie terminale należące do wybranej grupy
  context.subscriptions.push(
    vscode.commands.registerCommand("terminalManager.stopGroup", async () => {
      const { groups } = getCurrentConfig(); // Pobierz aktualną konfigurację
      const groupNames = Object.keys(groups);

      if (groupNames.length === 0) {
        vscode.window.showWarningMessage("Brak zdefiniowanych grup terminali.");
        return;
      }

      const selectedGroup = await vscode.window.showQuickPick(groupNames, {
        placeHolder: "Wybierz grupę terminali do zatrzymania",
      });

      if (!selectedGroup) return;

      const terminalNames = groups[selectedGroup];

      terminalNames.forEach((name) => {
        const term = terminalMap.get(name);
        if (term) {
          term.dispose();
          terminalMap.delete(name);
        } else {
          vscode.window.showInformationMessage(
            `Terminal "${name}" nie jest otwarty.`
          );
        }
      });
    })
  );

  //info Uruchom skrypty npm z wybranych modułów/projektów (pojedynczy wybór)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "terminalManager.runScriptInModule",
      async () => {
        const { scriptModules } = getCurrentConfig();

        if (scriptModules.length === 0) {
          vscode.window.showWarningMessage(
            "Brak zdefiniowanych modułów w 'terminalManager.scriptModules'."
          );
          return;
        }

        // Filtruj tylko moduły, które NIE mają zdefiniowanych runScripts
        const modulesWithoutScripts = scriptModules.filter(
          (mod) =>
            !mod.runScripts ||
            !Array.isArray(mod.runScripts) ||
            mod.runScripts.length === 0
        );

        if (modulesWithoutScripts.length === 0) {
          vscode.window.showWarningMessage(
            "Brak modułów bez zdefiniowanych 'runScripts'. Wszystkie moduły mają predefiniowane skrypty - użyj 'Run Scripts In Selected Modules'."
          );
          return;
        }

        const selectedModule = await vscode.window.showQuickPick(
          modulesWithoutScripts.map((mod) => ({
            label: mod.name,
            description: mod.location,
            mod,
          })),
          {
            placeHolder: "Wybierz moduł (folder z package.json)",
          }
        );

        if (!selectedModule) return;

        const { location, command: extraFlags = "" } = selectedModule.mod;

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
          vscode.window.showErrorMessage("Brak otwartego folderu roboczego.");
          return;
        }

        const modulePath = path.isAbsolute(location)
          ? location
          : path.join(workspaceFolder.uri.fsPath, location);
        const packageJsonPath = path.join(modulePath, "package.json");

        let scripts: string[] = [];

        try {
          const fileContent = fs.readFileSync(packageJsonPath, "utf8");
          const pkg = JSON.parse(fileContent);

          if (pkg.scripts && typeof pkg.scripts === "object") {
            scripts = Object.keys(pkg.scripts);
          } else {
            vscode.window.showErrorMessage(
              `Brak sekcji "scripts" w ${packageJsonPath}`
            );
            return;
          }
        } catch (err) {
          vscode.window.showErrorMessage(
            `Błąd wczytywania package.json: ${(err as Error).message}`
          );
          return;
        }

        const selectedScript = await vscode.window.showQuickPick(
          scripts.reverse(),
          {
            placeHolder: "Wybierz akcję (npm script)",
          }
        );

        if (!selectedScript) return;

        await runScriptInModule(
          selectedModule.label,
          location,
          selectedScript,
          extraFlags
        );
      }
    )
  );

  //info Uruchom predefiniowane skrypty w wybranych modułach
  // context.subscriptions.push(
  //   vscode.commands.registerCommand(
  //     "terminalManager.runScriptsInSelectedModules",
  //     async () => {
  //       const { scriptModules } = getCurrentConfig();

  //       if (scriptModules.length === 0) {
  //         vscode.window.showWarningMessage(
  //           "Brak zdefiniowanych modułów w 'terminalManager.scriptModules'."
  //         );
  //         return;
  //       }

  //       // Filtruj tylko moduły, które mają zdefiniowane runScripts
  //       const modulesWithScripts = scriptModules.filter(
  //         (mod) =>
  //           mod.runScripts &&
  //           Array.isArray(mod.runScripts) &&
  //           mod.runScripts.length > 0
  //       );

  //       if (modulesWithScripts.length === 0) {
  //         vscode.window.showWarningMessage(
  //           "Brak modułów z zdefiniowanymi 'runScripts'. Dodaj pole 'runScripts' z tablicą nazw skryptów npm do konfiguracji modułów."
  //         );
  //         return;
  //       }

  //       const selectedModules = await vscode.window.showQuickPick(
  //         modulesWithScripts.map((mod) => ({
  //           label: mod.name,
  //           description: `${mod.location} - Skrypty: ${mod.runScripts.join(
  //             ", "
  //           )}`,
  //           mod,
  //         })),
  //         {
  //           canPickMany: true,
  //           placeHolder:
  //             "Wybierz moduły, w których chcesz uruchomić predefiniowane skrypty",
  //         }
  //       );

  //       if (!selectedModules || selectedModules.length === 0) {
  //         vscode.window.showInformationMessage("Nie wybrano żadnych modułów.");
  //         return;
  //       }

  //       // Uruchom wszystkie predefiniowane skrypty dla każdego wybranego modułu
  //       for (const selectedModule of selectedModules) {
  //         const {
  //           location,
  //           command: extraFlags = "",
  //           runScripts,
  //         } = selectedModule.mod;

  //         for (const script of runScripts) {
  //           await runScriptInModule(
  //             selectedModule.label,
  //             location,
  //             script,
  //             extraFlags
  //           );
  //         }
  //       }

  //       // ! test innego dzialania wyswietlania terminali

  //       // ! test innego dzialania wyswietlania terminali

  //       vscode.window.showInformationMessage(
  //         `Uruchomiono skrypty w ${selectedModules.length} module(ach).`
  //       );
  //     }
  //   )
  // );
  //   context.subscriptions.push(
  //     vscode.commands.registerCommand(
  //       "terminalManager.runScriptsInSelectedModules",
  //       async () => {
  //         const { scriptModules } = getCurrentConfig();

  //         if (scriptModules.length === 0) {
  //           vscode.window.showWarningMessage(
  //             "Brak zdefiniowanych modułów w 'terminalManager.scriptModules'."
  //           );
  //           return;
  //         }

  //         // Filtruj tylko moduły, które mają zdefiniowane runScripts
  //         const modulesWithScripts = scriptModules.filter(
  //           (mod) =>
  //             mod.runScripts &&
  //             Array.isArray(mod.runScripts) &&
  //             mod.runScripts.length > 0
  //         );

  //         if (modulesWithScripts.length === 0) {
  //           vscode.window.showWarningMessage(
  //             "Brak modułów z zdefiniowanymi 'runScripts'. Dodaj pole 'runScripts' z tablicą nazw skryptów npm do konfiguracji modułów."
  //           );
  //           return;
  //         }

  //         const selectedModules = await vscode.window.showQuickPick(
  //           modulesWithScripts.map((mod) => ({
  //             label: mod.name,
  //             description: `${mod.location} - Skrypty: ${mod.runScripts.join(
  //               ", "
  //             )}`,
  //             mod,
  //           })),
  //           {
  //             canPickMany: true,
  //             placeHolder:
  //               "Wybierz moduły, w których chcesz uruchomić predefiniowane skrypty",
  //           }
  //         );

  //         if (!selectedModules || selectedModules.length === 0) {
  //           vscode.window.showInformationMessage("Nie wybrano żadnych modułów.");
  //           return;
  //         }

  //         // Uruchom wszystkie predefiniowane skrypty dla każdego wybranego modułu
  //         for (const selectedModule of selectedModules) {
  //           const {
  //             location,
  //             command: extraFlags = "",
  //             runScripts,
  //             name,
  //           } = selectedModule.mod;

  //           // Utwórz pełną ścieżkę do katalogu modułu
  //           const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  //           if (!workspaceFolder) {
  //             vscode.window.showErrorMessage("Brak otwartego folderu roboczego.");
  //             continue;
  //           }

  //           const modulePath = path.isAbsolute(location)
  //             ? location
  //             : path.join(workspaceFolder.uri.fsPath, location);

  //           // Sprawdź czy katalog istnieje
  //           if (!fs.existsSync(modulePath)) {
  //             vscode.window.showErrorMessage(
  //               `Katalog "${modulePath}" nie istnieje dla modułu "${name}".`
  //             );
  //             continue;
  //           }

  //           // Utwórz jeden terminal dla wszystkich skryptów modułu
  //           const terminalName = `[Module] ${name}`;
  //           let terminal: vscode.Terminal;

  //           // Sprawdź czy terminal o takiej nazwie już istnieje
  //           const existingTerminal = terminalMap.get(terminalName);
  //           if (existingTerminal) {
  //             terminal = existingTerminal;
  //             terminal.show();
  //           } else {
  //             terminal = vscode.window.createTerminal({
  //               name: terminalName,
  //               cwd: modulePath,
  //             });
  //             terminalMap.set(terminalName, terminal);
  //           }

  //           terminal.show();

  //           // // Zbuduj polecenia połączone && żeby wykonały się kolejno
  //           // const chainedCommands = runScripts
  //           //   .map((script: any) => `npm run ${script} ${extraFlags}`.trim())
  //           //   .join(" && ");

  //           // terminal.sendText(chainedCommands);

  //           terminal.show();

  //           // Wykryj system operacyjny i dostosuj format komend
  //           const isWindows = process.platform === "win32";

  //           if (isWindows) {
  //             // Dla Windows używamy skryptu PowerShell z minimalnym formatowaniem
  //             let powershellScript = "";

  //             // Inicjalizacja zmiennych
  //             powershellScript += "$global:failed = $false\n";
  //             powershellScript += "$ErrorActionPreference = 'Continue'\n";
  //             powershellScript += "Clear-Host\n";

  //             // Dodajemy każdy skrypt z obsługą błędów
  //             for (let i = 0; i < runScripts.length; i++) {
  //               const script = runScripts[i];

  //               // Uruchomienie komendy bezpośrednio bez dodatkowych komunikatów
  //               powershellScript += `npm run ${script} ${extraFlags}\n`;

  //               // Prosty komunikat o wyniku
  //               powershellScript += `if ($LASTEXITCODE -ne 0) {
  //   echo "${script}: Błąd"
  //   $global:failed = $true
  //   break
  // } else {
  //   echo "${script}: OK"
  // }\n`;

  //               // Prosty separator
  //               if (i < runScripts.length - 1) {
  //                 powershellScript += `echo "---"\n`;
  //               }
  //             }

  //             // Końcowe podsumowanie - bardzo minimalne
  //             powershellScript += `if ($global:failed) {
  //   echo "Wynik: Wystąpiły błędy"
  // } else {
  //   echo "Wynik: OK"
  // }\n`;

  //             // Wysyłamy skrypt PowerShell do wykonania
  //             terminal.sendText(powershellScript);
  //           } else {
  //             // Dla Linux/MacOS używamy skryptu bash z minimalnym formatowaniem
  //             let bashScript = "";

  //             // Inicjalizacja zmiennych
  //             bashScript += "failed=0\n";
  //             bashScript += "clear\n";

  //             // Dodajemy każdy skrypt z obsługą błędów
  //             for (let i = 0; i < runScripts.length; i++) {
  //               const script = runScripts[i];

  //               // Uruchomienie komendy bezpośrednio
  //               bashScript += `npm run ${script} ${extraFlags}\n`;

  //               // Prosty komunikat o wyniku
  //               bashScript += `if [ $? -ne 0 ]; then
  //   echo "${script}: Błąd"
  //   failed=1
  //   break
  // else
  //   echo "${script}: OK"
  // fi\n`;

  //               // Prosty separator
  //               if (i < runScripts.length - 1) {
  //                 bashScript += `echo "---"\n`;
  //               }
  //             }

  //             // Końcowe podsumowanie - bardzo minimalne
  //             bashScript += `if [ $failed -eq 1 ]; then
  //   echo "Wynik: Wystąpiły błędy"
  // else
  //   echo "Wynik: OK"
  // fi\n`;

  //             // Wysyłamy skrypt bash do wykonania
  //             terminal.sendText(bashScript);
  //           }

  //           // Dodaj obsługę zamknięcia terminala
  //           const disposable = vscode.window.onDidCloseTerminal(
  //             (closedTerminal) => {
  //               if (closedTerminal === terminal) {
  //                 terminalMap.delete(terminalName);
  //                 disposable.dispose();
  //               }
  //             }
  //           );

  //           context.subscriptions.push(disposable);
  //         }

  //         vscode.window.showInformationMessage(
  //           `Uruchomiono skrypty w ${selectedModules.length} module(ach).`
  //         );
  //       }
  //     )
  //   );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "terminalManager.runScriptsInSelectedModules",
      async () => {
        const { scriptModules } = getCurrentConfig();

        if (scriptModules.length === 0) {
          vscode.window.showWarningMessage(
            "Brak zdefiniowanych modułów w 'terminalManager.scriptModules'."
          );
          return;
        }

        const modulesWithScripts = scriptModules.filter(
          (mod) =>
            mod.runScripts &&
            Array.isArray(mod.runScripts) &&
            mod.runScripts.length > 0
        );

        if (modulesWithScripts.length === 0) {
          vscode.window.showWarningMessage(
            "Brak modułów z zdefiniowanymi 'runScripts'. Dodaj pole 'runScripts' z tablicą nazw skryptów npm do konfiguracji modułów."
          );
          return;
        }

        const selectedModules = await vscode.window.showQuickPick(
          modulesWithScripts.map((mod) => ({
            label: mod.name,
            description: `${mod.location} - Skrypty: ${mod.runScripts.join(
              ", "
            )} ${mod.command ? `- Flagi: ${mod.command}` : ""}`,
            mod,
          })),
          {
            canPickMany: true,
            placeHolder:
              "Wybierz moduły, w których chcesz uruchomić predefiniowane skrypty",
          }
        );

        if (!selectedModules || selectedModules.length === 0) {
          vscode.window.showInformationMessage("Nie wybrano żadnych modułów.");
          return;
        }

        for (const selectedModule of selectedModules) {
          const {
            location,
            command: extraFlags = "",
            runScripts,
            name,
          } = selectedModule.mod;

          const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
          if (!workspaceFolder) {
            vscode.window.showErrorMessage("Brak otwartego folderu roboczego.");
            continue;
          }

          const modulePath = path.isAbsolute(location)
            ? location
            : path.join(workspaceFolder.uri.fsPath, location);

          if (!fs.existsSync(modulePath)) {
            vscode.window.showErrorMessage(
              `Katalog "${modulePath}" nie istnieje dla modułu "${name}".`
            );
            continue;
          }

          const terminalName = `[Module] ${name}`;
          let terminal: vscode.Terminal;

          const existingTerminal = terminalMap.get(terminalName);
          if (existingTerminal) {
            existingTerminal.dispose();
            terminalMap.delete(terminalName);
          }

          terminal = vscode.window.createTerminal({
            name: terminalName,
            cwd: modulePath,
          });
          terminalMap.set(terminalName, terminal);
          terminal.show();

          const isWindows = process.platform === "win32";
          const { autoClose = false } = selectedModule.mod;
          const { autoCloseWhenFail = false } = selectedModule.mod;

          if (isWindows) {
            let powershellScript = "Clear-Host\n";

            for (let i = 0; i < runScripts.length; i++) {
              const script = runScripts[i];
              const command = `npm run ${script} ${extraFlags}`.trim();

              powershellScript += `${command}\n`;

              if (autoCloseWhenFail) {
                //jeżeli ma zamknąć terminal po błędzie
                powershellScript += `if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }\n`;
              }

              //jeżeli ma kontynuować po błędzie
              // powershellScript += `if ($LASTEXITCODE -ne 0) { Write-Host "Błąd w skrypcie, kontynuuję..." }\n`;
            }

            // zamknij terminal jeśli wszystko OK
            if (autoClose) {
              powershellScript += `exit\n`;
            }

            terminal.sendText(powershellScript);
          } else {
            let bashScript = "clear\n";

            for (let i = 0; i < runScripts.length; i++) {
              const script = runScripts[i];
              const command = `npm run ${script} ${extraFlags}`.trim();

              bashScript += `${command}\n`;

              if (autoCloseWhenFail) {
                // jeżeli ma zamknąć terminal po błędzie
                bashScript += `if [ $? -ne 0 ]; then exit 1; fi\n`;
              }

              // bashScript += `if [ $? -ne 0 ]; then echo "Błąd w skrypcie, kontynuuję..."; fi\n`;
            }

            // zamknij terminal jeśli wszystko OK
            if (autoClose) {
              bashScript += `exit\n`;
            }

            terminal.sendText(bashScript);
          }

          const disposable = vscode.window.onDidCloseTerminal(
            (closedTerminal) => {
              if (closedTerminal === terminal) {
                terminalMap.delete(terminalName);
                disposable.dispose();
              }
            }
          );

          context.subscriptions.push(disposable);
        }

        vscode.window.showInformationMessage(
          `Uruchomiono skrypty w ${selectedModules.length} module(ach).`
        );
      }
    )
  );

  //info Zatrzymaj skrypty npm z wybranych modułów/projektów (pojedynczy wybór)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "terminalManager.stopScriptInModule",
      async () => {
        const terminals = Array.from(terminalMap.entries())
          .filter(
            ([name, _]) => name.includes(" - ") || name.startsWith("[Module] ") // oba wzorce
          )
          .map(([name]) => name);

        if (terminals.length === 0) {
          vscode.window.showInformationMessage(
            "Brak aktywnych terminali ze skryptami do modułów."
          );
          return;
        }

        const selection = await vscode.window.showQuickPick(terminals, {
          canPickMany: true,
          placeHolder:
            "Wybierz terminale skryptów do modułów, które mają zostać zatrzymane",
        });

        if (!selection || selection.length === 0) {
          vscode.window.showInformationMessage(
            "Nie wybrano żadnych terminali."
          );
          return;
        }

        selection.forEach((name) => {
          const term = terminalMap.get(name);
          if (term) {
            term.dispose();
            terminalMap.delete(name);
          }
        });

        vscode.window.showInformationMessage(
          `Zatrzymano ${selection.length} terminali ze skryptami.`
        );
      }
    )
  );

  //info Zatrzymaj skrypty w wybranych modułach (grupowo)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "terminalManager.stopScriptsInSelectedModules",
      async () => {
        // Pobierz wszystkie aktywne terminale związane ze skryptami
        const scriptTerminals = Array.from(terminalMap.entries())
          .filter(
            ([name, _]) => name.includes(" - ") || name.startsWith("[Module] ") // oba wzorce
          )
          .map(([name, terminal]) => ({ name, terminal }));

        if (scriptTerminals.length === 0) {
          vscode.window.showInformationMessage(
            "Brak aktywnych terminali ze skryptami."
          );
          return;
        }

        // Grupuj terminale po modułach
        const moduleGroups: { [moduleName: string]: string[] } = {};

        scriptTerminals.forEach(({ name }) => {
          let moduleName: string;

          if (name.startsWith("[Module] ")) {
            //format: "[Module] NazwaModułu"
            moduleName = name.replace("[Module] ", "");
          } else if (name.includes(" - ")) {
            //format: "NazwaModułu - skrypt"
            moduleName = name.split(" - ")[0];
          } else {
            moduleName = name; // fallback
          }

          if (!moduleGroups[moduleName]) {
            moduleGroups[moduleName] = [];
          }
          moduleGroups[moduleName].push(name);
        });

        const moduleNames = Object.keys(moduleGroups);

        if (moduleNames.length === 0) {
          vscode.window.showInformationMessage(
            "Brak terminali ze skryptami do zatrzymania."
          );
          return;
        }

        const selectedModules = await vscode.window.showQuickPick(
          moduleNames.map((moduleName) => ({
            label: moduleName,
            description: `Aktywne terminale: ${moduleGroups[moduleName].length}`,
          })),
          {
            canPickMany: true,
            placeHolder: "Wybierz moduły, których skrypty chcesz zatrzymać",
          }
        );

        if (!selectedModules || selectedModules.length === 0) {
          vscode.window.showInformationMessage("Nie wybrano żadnych modułów.");
          return;
        }

        let stoppedCount = 0;

        selectedModules.forEach((selectedModule) => {
          const terminalNames = moduleGroups[selectedModule.label];
          terminalNames.forEach((name) => {
            const term = terminalMap.get(name);
            if (term) {
              term.dispose();
              terminalMap.delete(name);
              stoppedCount++;
            }
          });
        });

        vscode.window.showInformationMessage(
          `Zatrzymano ${stoppedCount} terminali ze skryptami.`
        );
      }
    )
  );

  //info Uruchom terminale z autoStart=true automatycznie po uruchomieniu vscode
  const { terminals: initialTerminals } = getCurrentConfig();
  initialTerminals.forEach((term) => {
    if (term.autoStart) {
      startTerminal(term.name, term.commands, term.location);
    }
  });

  //info Nasłuchuj na zmiany konfiguracji terminalManager
  //   vscode.workspace.onDidChangeConfiguration((e) => {
  //     if (
  //       e.affectsConfiguration("terminalManager.terminals") ||
  //       e.affectsConfiguration("terminalManager.groups") ||
  //       e.affectsConfiguration("terminalManager.scriptModules")
  //     ) {
  //       vscode.window.showInformationMessage(
  //         "Zmieniono konfigurację terminali - przeładowuję terminale..."
  //       );

  //       // Zatrzymaj wszystkie istniejące terminale
  //       terminalMap.forEach((term) => term.dispose());
  //       terminalMap.clear();

  //       // Zatrzymaj wszystkie watchers
  //       fileWatchers.forEach((watcher) => watcher.dispose());
  //       fileWatchers.clear();

  //       // Załaduj nową konfigurację i uruchom terminale z autoStart = true
  //       const { terminals: newTerminals } = getCurrentConfig();
  //       newTerminals.forEach((term) => {
  //         if (term.autoStart) {
  //           startTerminal(term.name, term.commands, term.location);
  //         }
  //       });
  //     }
  //   });

  let previousConfig = getCurrentConfig();

  vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("terminalManager")) {
      const newConfig = getCurrentConfig();

      // Porównaj poprzednią i nową konfigurację terminali
      if (e.affectsConfiguration("terminalManager.terminals")) {
        const oldTerminals = previousConfig.terminals;
        const newTerminals = newConfig.terminals;

        // Znajdź terminale, które się zmieniły
        const changedTerminals = newTerminals.filter((newTerm) => {
          const oldTerm = oldTerminals.find((t) => t.name === newTerm.name);
          return oldTerm && JSON.stringify(oldTerm) !== JSON.stringify(newTerm);
        });

        // Znajdź terminale, które zostały usunięte
        const removedTerminals = oldTerminals.filter(
          (oldTerm) => !newTerminals.find((t) => t.name === oldTerm.name)
        );

        // Zatrzymaj usunięte terminale
        removedTerminals.forEach((term) => {
          const terminal = terminalMap.get(term.name);
          if (terminal) {
            terminal.dispose();
            terminalMap.delete(term.name);
          }
          // Usuń watcher jeśli istnieje
          if (term.location) {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            let fullPath = term.location;
            if (
              workspaceFolders &&
              workspaceFolders.length > 0 &&
              !path.isAbsolute(term.location)
            ) {
              fullPath = path.join(
                workspaceFolders[0].uri.fsPath,
                term.location
              );
            }
            const watcher = fileWatchers.get(fullPath);
            if (watcher) {
              watcher.dispose();
              fileWatchers.delete(fullPath);
            }
          }
        });

        // Przeładuj zmienione terminale (tylko te z autoStart = true)
        changedTerminals.forEach((term) => {
          // Zatrzymaj stary terminal
          const oldTerminal = terminalMap.get(term.name);
          if (oldTerminal) {
            oldTerminal.dispose();
            terminalMap.delete(term.name);
          }

          // Usuń stary watcher
          if (term.location) {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            let fullPath = term.location;
            if (
              workspaceFolders &&
              workspaceFolders.length > 0 &&
              !path.isAbsolute(term.location)
            ) {
              fullPath = path.join(
                workspaceFolders[0].uri.fsPath,
                term.location
              );
            }
            const watcher = fileWatchers.get(fullPath);
            if (watcher) {
              watcher.dispose();
              fileWatchers.delete(fullPath);
            }
          }

          // Uruchom nowy terminal jeśli ma autoStart
          if (term.autoStart) {
            startTerminal(term.name, term.commands, term.location);
          }
        });

        if (changedTerminals.length > 0 || removedTerminals.length > 0) {
          vscode.window.showInformationMessage(
            `Przeładowano ${changedTerminals.length} terminali, usunięto ${removedTerminals.length}.`
          );
        }
      }

      previousConfig = newConfig;
    }
  });
}

//info Funkcja wywoływana przy dezaktywacji rozszerzenia – czyści terminale
export function deactivate() {
  terminalMap.forEach((term) => term.dispose());
  terminalMap.clear();

  fileWatchers.forEach((watcher) => watcher.dispose());
  fileWatchers.clear();
}
