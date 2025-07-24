# Terminal Manager for VS Code

A lightweight extension that lets you define, launch, and stop **named terminal sessions and terminal groups** directly from the Command Palette or keyboard shortcuts. Ideal when your project needs several long‑running processes (e.g. frontend, backend, database, build watcher) but you don't want them running all the time.

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
| **External Config**    | Load commands from external JSON files using the `location` property                |
| **Auto Reload**        | Automatically reloads terminals when configuration changes                          |

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

### Basic Configuration

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

### Configuration with External Files

```jsonc
{
  "terminalManager.terminals": [
    {
      "name": "Complex Setup",
      "location": "./configs/terminal-commands.json",
      "autoStart": true
    },
    {
      "name": "Simple Terminal",
      "commands": ["echo 'Hello World'"],
      "autoStart": false
    }
  ]
}
```

Example `./configs/terminal-commands.json`:

```json
{
  "commands": ["npm install", "npm run build", "npm start"]
}
```

### Settings Reference

| Setting                     | Type     | Description                                                                           |
| --------------------------- | -------- | ------------------------------------------------------------------------------------- |
| `terminalManager.terminals` | `array`  | List of terminal objects with **name**, **commands/location**, and **autoStart** flag |
| `terminalManager.groups`    | `object` | Map of **groupName → array of terminal names**                                        |

#### Terminal Object Properties

| Property    | Type       | Required | Description                                                   |
| ----------- | ---------- | -------- | ------------------------------------------------------------- |
| `name`      | `string`   | ✅       | Display name for the terminal                                 |
| `commands`  | `string[]` | ✅\*     | Array of commands to execute in sequence                      |
| `location`  | `string`   | ✅\*     | Path to JSON file containing commands (relative to workspace) |
| `autoStart` | `boolean`  | ❌       | Whether this terminal should start with "Start All" command   |

\*Either `commands` OR `location` is required, but not both.

---

## 🖱️ Commands & Keyboard Shortcuts

All commands are available via the Command Palette and have default keyboard shortcuts:

| Command Id                      | Palette Label                 | Default Shortcut |
| ------------------------------- | ----------------------------- | ---------------- |
| `terminalManager.startAll`      | **Terminals: Start All**      | `Alt+1`          |
| `terminalManager.stopAll`       | **Terminals: Stop All**       | `Alt+2`          |
| `terminalManager.startTerminal` | **Terminals: Start Terminal** | `Alt+3`          |
| `terminalManager.stopTerminal`  | **Terminals: Stop Terminal**  | `Alt+4`          |
| `terminalManager.startGroup`    | **Terminals: Start Group**    | `Alt+5`          |
| `terminalManager.stopGroup`     | **Terminals: Stop Group**     | `Alt+6`          |
| `terminalManager.startSelected` | **Terminals: Start Selected** | `Shift+1`        |
| `terminalManager.stopSelected`  | **Terminals: Stop Selected**  | `Shift+2`        |

### Customizing Keyboard Shortcuts

To customize keyboard shortcuts, open **File → Preferences → Keyboard Shortcuts** (or press `Ctrl+K Ctrl+S`) and search for `terminalManager`. You can then assign your preferred key combinations.

Alternatively, add custom keybindings in your `keybindings.json`:

```jsonc
[
  {
    "key": "ctrl+alt+t",
    "command": "terminalManager.startAll"
  },
  {
    "key": "ctrl+alt+s",
    "command": "terminalManager.stopAll"
  }
]
```

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

### Using External Configuration Files

```jsonc
{
  "name": "Microservices",
  "location": "./scripts/microservices.json",
  "autoStart": true
}
```

Where `./scripts/microservices.json` contains:

```json
{
  "commands": [
    "docker-compose up -d database",
    "sleep 5",
    "cd user-service && npm start &",
    "cd payment-service && npm start &",
    "cd notification-service && npm start"
  ]
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

## 🔄 Auto-reload Behavior

The extension automatically monitors changes to the `terminalManager.terminals` configuration. When you modify your settings:

1. All currently running terminals are automatically stopped
2. The terminal map is cleared
3. New configuration is loaded
4. Terminals with `"autoStart": true` are automatically restarted

This ensures your terminal setup stays in sync with your configuration without requiring a VS Code reload.

---

## 📋 Known Issues

- Closing a terminal manually (✖) does **not** remove it from internal tracking. Use **Terminals: Stop Terminal** or **Terminals: Stop Selected** to properly clean up the terminal map.

---

## 🛠️ Development

### Prerequisites

- Node.js 20.x or higher
- VS Code 1.102.0 or higher

### Build Commands

```bash
npm install          # Install dependencies
npm run compile      # Compile TypeScript
npm run watch        # Watch mode for development
npm run lint         # Run ESLint
npm run test         # Run tests
npm run vscode:prepublish  # Prepare for publishing
```

---

## 📦 Release Notes

### 1.1.0

- Added support for external command files via `location` property
- Implemented automatic configuration reload
- Improved error handling for file operations
- Enhanced keyboard shortcuts support

### 1.0.0

- Initial public version
- Start/stop commands for individual terminals and groups
- Multi-select interface for batch operations
- Support for multiple commands per terminal executed in sequence
