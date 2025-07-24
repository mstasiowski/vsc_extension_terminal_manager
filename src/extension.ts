import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

//info Mapa przechowująca aktywne terminale (nazwa => obiekt terminala)
let terminalMap: Map<string, vscode.Terminal> = new Map();

//info Mapa przechowująca watchers dla plików
let fileWatchers: Map<string, vscode.FileSystemWatcher> = new Map();

//info Funkcja aktywująca rozszerzenie
export function activate(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration("terminalManager");
  const terminals = config.get<any[]>("terminals") || [];

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

  //info Komenda: uruchom wszystkie terminale z autoStart = true
  context.subscriptions.push(
    vscode.commands.registerCommand("terminalManager.startAll", () => {
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
      const groups = config.get<{ [key: string]: string[] }>("groups") || {};
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
      const groups = config.get<{ [key: string]: string[] }>("groups") || {};
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

  //info Uruchom terminale z autoStart=true automatycznie po uruchomieniu vscode
  terminals.forEach((term) => {
    if (term.autoStart) {
      startTerminal(term.name, term.commands, term.location);
    }
  });

  //info Nasłuchuj na zmiany konfiguracji terminalManager.terminals i terminalManager.groups
  vscode.workspace.onDidChangeConfiguration((e) => {
    if (
      e.affectsConfiguration("terminalManager.terminals") ||
      e.affectsConfiguration("terminalManager.groups")
    ) {
      vscode.window.showInformationMessage(
        "Zmieniono konfigurację terminali lub grup - przeładowuję terminale..."
      );

      // Zatrzymaj wszystkie istniejące terminale
      terminalMap.forEach((term) => term.dispose());
      terminalMap.clear();

      // Zatrzymaj wszystkie watchers
      fileWatchers.forEach((watcher) => watcher.dispose());
      fileWatchers.clear();

      // Załaduj nową konfigurację
      const newConfig = vscode.workspace.getConfiguration("terminalManager");
      const newTerminals = newConfig.get<any[]>("terminals") || [];

      // Uruchom terminale z autoStart = true z nowej konfiguracji
      newTerminals.forEach((term) => {
        if (term.autoStart) {
          startTerminal(term.name, term.commands, term.location);
        }
      });
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
