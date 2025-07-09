# Terminal Manager for VS Code

A lightweight extension that lets you define, launch, and stop **named terminal sessions and terminal groups** directly from the Command Palette. Ideal when your project needs several long‑running processes (e.g. frontend, backend, database, build watcher) but you don't want them running all the time.

---

## ✨ Key Features

| Feature                | What it does                                                                        |
| ---------------------- | ----------------------------------------------------------------------------------- |
| **Start All**          | Launches every terminal that has `"autoStart": true` in your settings               |
| **Start Selected**     | Multi‑select UI to start any subset of terminals                                    |
| **Stop Selected**      | Multi‑select UI to stop chosen running terminals                                    |
| **Start / Stop Group** | Launch or dispose an entire group of terminals defined in settings                  |
| **Start / Stop One**   | Quick pick to handle a single terminal                                              |
| **Persist Names**      | Each terminal keeps a stable, human‑friendly name so you always know what's running |
| **Multiple Commands**  | Each terminal can execute multiple commands in sequence                             |

---

## 🚀 Getting Started

1. **Build the extension**

   ```bash
   npm install
   npm run vscode:prepublish
   vsce package
   ```

   This produces `terminal-manager‑*.vsix`.

2. **Install locally**

   ```bash
   code --install-extension terminal-manager-<version>.vsix
   ```

   or **Extensions → ⋮ → Install from VSIX…**.

3. Reload VS Code and open the **Command Palette ⇧⌘P / ⇧CtrlP**. Type `Terminals:` to see all available actions.

---

## ⚙️ Configuration

Add terminals and groups in your _workspace_ or _user_ `settings.json`.

```jsonc
{
  "terminalManager.terminals": [
    {
      "name": "Dev Server",
      "commands": ["npm install", "npm run dev"],
      "autoStart": true
    },
    {
      "name": "Backend API",
      "commands": ["cd backend", "yarn install", "yarn start:api"],
      "autoStart": false
    },
    {
      "name": "MongoDB",
      "commands": ["docker compose up"],
      "autoStart": false
    }
  ],
  "terminalManager.groups": {
    "dev": ["Dev Server", "Backend API"],
    "infra": ["MongoDB"]
  }
}
```

### Settings Reference

| Setting                     | Type     | Description                                                                  |
| --------------------------- | -------- | ---------------------------------------------------------------------------- |
| `terminalManager.terminals` | `array`  | List of terminal objects with **name**, **commands**, and **autoStart** flag |
| `terminalManager.groups`    | `object` | Map of **groupName → array of terminal names**                               |

#### Terminal Object Properties

| Property    | Type       | Required | Description                                                 |
| ----------- | ---------- | -------- | ----------------------------------------------------------- |
| `name`      | `string`   | ✅       | Display name for the terminal                               |
| `commands`  | `string[]` | ✅       | Array of commands to execute in sequence                    |
| `autoStart` | `boolean`  | ❌       | Whether this terminal should start with "Start All" command |

---

## 🖱️ Commands

All commands are available via the Command Palette:

| Command Id                      | Palette label                 |
| ------------------------------- | ----------------------------- |
| `terminalManager.startAll`      | **Terminals: Start All**      |
| `terminalManager.stopAll`       | **Terminals: Stop All**       |
| `terminalManager.startSelected` | **Terminals: Start Selected** |
| `terminalManager.stopSelected`  | **Terminals: Stop Selected**  |
| `terminalManager.startTerminal` | **Terminals: Start One**      |
| `terminalManager.stopTerminal`  | **Terminals: Stop One**       |
| `terminalManager.startGroup`    | **Terminals: Start Group**    |
| `terminalManager.stopGroup`     | **Terminals: Stop Group**     |

---

## 💡 Usage Examples

### Simple Terminal with Single Command

```jsonc
{
  "name": "Test Runner",
  "commands": ["npm test"],
  "autoStart": false
}
```

### Complex Terminal with Multiple Commands

```jsonc
{
  "name": "Full Stack Setup",
  "commands": [
    "cd frontend",
    "npm install",
    "npm run build",
    "cd ../backend",
    "python -m venv venv",
    "source venv/bin/activate",
    "pip install -r requirements.txt",
    "python manage.py runserver"
  ],
  "autoStart": true
}
```

### Docker Development Environment

```jsonc
{
  "terminalManager.terminals": [
    {
      "name": "Database",
      "commands": ["docker-compose up postgres"],
      "autoStart": true
    },
    {
      "name": "Redis Cache",
      "commands": ["docker-compose up redis"],
      "autoStart": true
    },
    {
      "name": "API Server",
      "commands": ["cd api", "npm install", "npm run migrate", "npm run dev"],
      "autoStart": false
    }
  ],
  "terminalManager.groups": {
    "infrastructure": ["Database", "Redis Cache"],
    "development": ["Database", "Redis Cache", "API Server"]
  }
}
```

---

## 📋 Known Issues

- Closing a terminal manually (✖) does **not** yet remove it from internal tracking. Use **Terminals: Stop One** or reload window to clear the map. _(Road‑map item)_

---

## 📦 Release Notes

### 1.0.0

- Initial public version – start / stop commands, groups, multi‑select.
- Support for multiple commands per terminal executed in sequence.
