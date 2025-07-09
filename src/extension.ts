import * as vscode from "vscode";

//info Mapa przechowująca aktywne terminale (nazwa → obiekt terminala)
let terminalMap: Map<string, vscode.Terminal> = new Map();

//info Funkcja aktywująca rozszerzenie
export function activate(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration("terminalManager");
  const terminals = config.get<any[]>("terminals") || [];

  //info Funkcja pomocnicza: uruchom terminal i dodaj go do mapy
  function startTerminal(name: string, commands: string[]) {
    if (terminalMap.has(name)) {
      vscode.window.showInformationMessage(`Terminal "${name}" już działa.`);
      return;
    }
    const term = vscode.window.createTerminal(name);
    terminalMap.set(name, term);
    term.show();

    // Wykonaj wszystkie komendy po kolei
    commands.forEach((command) => {
      term.sendText(command);
    });
  }

  //info Komenda: uruchom wszystkie terminale z autoStart = true
  context.subscriptions.push(
    vscode.commands.registerCommand("terminalManager.startAll", () => {
      terminals.forEach((term) => {
        if (term.autoStart) {
          startTerminal(term.name, term.commands);
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
            description: t.commands.join("; "), // Wyświetl wszystkie komendy oddzielone średnikami
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
            startTerminal(terminalConfig.name, terminalConfig.commands);
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
        if (term) startTerminal(term.name, term.commands);
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
        const term = terminalMap.get(pick!);
        if (term) {
          term.dispose();
          terminalMap.delete(pick!);
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
          startTerminal(terminalConfig.name, terminalConfig.commands);
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
}

//info Funkcja wywoływana przy dezaktywacji rozszerzenia – czyści terminale
export function deactivate() {
  terminalMap.forEach((term) => term.dispose());
  terminalMap.clear();
}
