# Terminal Manager for VS Code

A lightweight extension that lets you define, launch, and stop **named terminal sessions, terminal groups, and npm scripts from multiple projects** directly from the Command Palette or keyboard shortcuts. Ideal when your project needs several long‑running processes (e.g. frontend, backend, database, build watcher) but you don't want them running all the time.

---

## ✨ Key Features

| Feature                              | What it does                                                                        |
| ------------------------------------ | ----------------------------------------------------------------------------------- |
| **Start All**                        | Launches every terminal that has `"autoStart": true` in your settings               |
| **Start Selected**                   | Multi‑select UI to start any subset of terminals                                    |
| **Stop Selected**                    | Multi‑select UI to stop chosen running terminals                                    |
| **Start / Stop Group**               | Launch or dispose an entire group of terminals defined in settings                  |
| **Start / Stop One**                 | Quick pick to handle a single terminal                                              |
| **Run Script in Module**             | Execute npm scripts from different projects/modules with optional flags             |
| **Stop Script in Module**            | Stop running npm script terminals from modules                                      |
| **Run Scripts In Selected Modules**  | Runs a group of predefined scripts in selected modules                              |
| **Stop Scripts In Selected Modules** | Stops a group of predefined scripts in selected modules                             |
| **Persist Names**                    | Each terminal keeps a stable, human‑friendly name so you always know what's running |
| **Multiple Commands**                | Each terminal can execute multiple commands in sequence                             |
| **External Config**                  | Load commands from external JSON files using the `location` property                |
| **Auto Reload**                      | Automatically reloads terminals when configuration changes                          |

---

## 🚀 Getting Started

### Prerequisites for Development

- **Node.js 20.x or higher**
- **VS Code 1.102.0 or higher**
- **TypeScript** (installed via npm)
- **VSCE** (Visual Studio Code Extension manager) - install globally: `npm install -g @vscode/vsce`

### Building the Extension

1. **Clone/Download the project**
2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Compile TypeScript**

   ```bash
   npm run compile
   # or for watch mode during development:
   npm run watch
   ```

4. **Package the extension**

   ```bash
   npm run vscode:prepublish
   vsce package
   ```

   This produces `terminal-manager‑*.vsix`.

5. **Install locally**

   ```bash
   code --install-extension terminal-manager-<version>.vsix
   ```

   or **Extensions → ⋮ → Install from VSIX…**.

6. Reload VS Code and open the **Command Palette ⇧⌘P / ⇧CtrlP**. Type `Terminals:` to see all available actions.

---

## ⚙️ Configuration

Add terminals, groups, and script modules in your _workspace_ or _user_ `settings.json`.

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

### Script Modules Configuration

Execute npm scripts from different projects/modules:

```jsonc
{
  "terminalManager.scriptModules": [
    {
      "name": "Frontend App",
      "location": "projects/frontend"
    },
    {
      "name": "Backend API",
      "location": "projects/backend-api",
      "command": "--prod"
    },
    {
      "name": "Admin Panel",
      "location": "modules/admin",
      "command": "--host 0.0.0.0 --port 3001"
    }
  ]
}
```

The extension will:

1. Look for `package.json` in each module's location
2. Present available npm scripts for selection
3. Execute `npm run <script> <optional-flags>` in the module's directory

### Settings Reference

| Setting                         | Type     | Description                                                                           |
| ------------------------------- | -------- | ------------------------------------------------------------------------------------- |
| `terminalManager.terminals`     | `array`  | List of terminal objects with **name**, **commands/location**, and **autoStart** flag |
| `terminalManager.groups`        | `object` | Map of **groupName → array of terminal names**                                        |
| `terminalManager.scriptModules` | `array`  | List of project modules with package.json for running npm scripts                     |

#### Terminal Object Properties

| Property    | Type       | Required | Description                                                   |
| ----------- | ---------- | -------- | ------------------------------------------------------------- |
| `name`      | `string`   | ✅       | Display name for the terminal                                 |
| `commands`  | `string[]` | ✅\*     | Array of commands to execute in sequence                      |
| `location`  | `string`   | ✅\*     | Path to JSON file containing commands (relative to workspace) |
| `autoStart` | `boolean`  | ❌       | Whether this terminal should start with "Start All" command   |

\*Either `commands` OR `location` is required, but not both.

#### Script Module Object Properties

| Property     | Type       | Required | Description                                              |
| ------------ | ---------- | -------- | -------------------------------------------------------- |
| `name`       | `string`   | ✅       | Display name for the module                              |
| `location`   | `string`   | ✅       | Path to folder containing package.json                   |
| `command`    | `string`   | ❌       | Additional flags to append to npm run commands           |
| `runScripts` | `string[]` | ❌       | Select predefined scripts to run across multiple modules |

---

## 🖱️ Commands & Keyboard Shortcuts

All commands are available via the Command Palette and have default keyboard shortcuts:

| Command Id                                     | Palette Label                                   | Default Shortcut |
| ---------------------------------------------- | ----------------------------------------------- | ---------------- |
| `terminalManager.startAll`                     | **Terminals: Start All**                        | `Alt+1`          |
| `terminalManager.stopAll`                      | **Terminals: Stop All**                         | `Alt+2`          |
| `terminalManager.startTerminal`                | **Terminals: Start Terminal**                   | `Alt+3`          |
| `terminalManager.stopTerminal`                 | **Terminals: Stop Terminal**                    | `Alt+4`          |
| `terminalManager.startGroup`                   | **Terminals: Start Group**                      | `Alt+5`          |
| `terminalManager.stopGroup`                    | **Terminals: Stop Group**                       | `Alt+6`          |
| `terminalManager.startSelected`                | **Terminals: Start Selected**                   | `Shift+1`        |
| `terminalManager.stopSelected`                 | **Terminals: Stop Selected**                    | `Shift+2`        |
| `terminalManager.runScriptInModule`            | **Terminals: Run Script In Module**             | `Shift+3`        |
| `terminalManager.stopScriptInModule`           | **Terminals: Stop Script In Module**            | `Shift+4`        |
| `terminalManager.runScriptsInSelectedModules`  | **Terminals: Run Scripts in Selected Modules**  | `Shift+5`        |
| `terminalManager.stopScriptsInSelectedModules` | **Terminals: Stop Scripts in Selected Modules** | `Shift+6`        |

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
  },
  {
    "key": "ctrl+alt+r",
    "command": "terminalManager.runScriptInModule"
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

### Script Modules for Multiple Projects

```jsonc
{
  "terminalManager.scriptModules": [
    {
      "name": "Main App",
      "location": "apps/main-application"
    },
    {
      "name": "Admin Dashboard",
      "location": "apps/admin-dashboard",
      "command": "--host 0.0.0.0 --port 3001"
    },
    {
      "name": "Mobile API",
      "location": "services/mobile-api",
      "command": "--env development"
    },
    {
      "name": "Admin Panel",
      "location": "project/administration",
      "runScripts": ["watch", "build", "test"]
    }
  ]
}
```

**Usage Flow:**

1. Press `Shift+3` or run **Terminals: Run Script In Module**
2. Select a module (e.g., "Admin Dashboard")
3. Choose an npm script (e.g., "start", "build", "test")
4. Terminal opens and runs: `npm run start --host 0.0.0.0 --port 3001`

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
  },
  "terminalManager.scriptModules": [
    {
      "name": "API",
      "location": "api"
    },
    {
      "name": "Frontend",
      "location": "frontend"
    }
  ]
}
```

---

## 🔄 Auto-reload Behavior

The extension automatically monitors changes to all `terminalManager.*` configurations. When you modify your settings:

1. All currently running terminals are automatically stopped
2. The terminal map is cleared
3. New configuration is loaded
4. Terminals with `"autoStart": true` are automatically restarted

This ensures your terminal setup stays in sync with your configuration without requiring a VS Code reload.

---

## 📋 Known Issues

- Closing a terminal manually (✖) does **not** remove it from internal tracking. Use **Terminals: Stop Terminal**, **Terminals: Stop Selected**, or **Terminals: Stop Script In Module** to properly clean up the terminal map.

---

## 🛠️ Development & Contributing

### Development Setup

1. **Clone the repository**
2. **Install dependencies**
   ```bash
   npm install
   ```
3. **Open in VS Code**
4. **Start development**
   ```bash
   npm run watch    # Compile TypeScript in watch mode
   ```
5. **Press F5** to launch a new Extension Development Host window
6. **Test your changes** in the development window

### Build Commands

```bash
npm install              # Install dependencies
npm run compile          # Compile TypeScript once
npm run watch            # Watch mode for development
npm run lint             # Run ESLint
npm run test             # Run tests
npm run vscode:prepublish # Prepare for publishing (includes compile & lint)
vsce package             # Create .vsix package
```

### Project Structure

```
terminal-manager/
├── src/
│   └── extension.ts     # Main extension code
├── out/                 # Compiled JavaScript (generated)
├── package.json         # Extension manifest & dependencies
├── tsconfig.json        # TypeScript configuration
├── .eslintrc.json       # ESLint configuration
└── README.md            # This file
```

### Required Tools for Development

- **Node.js 20.x+** - Runtime environment
- **TypeScript** - Language (installed via npm)
- **VS Code 1.102.0+** - Development environment
- **VSCE** - Extension packaging tool
  ```bash
  npm install -g @vscode/vsce
  ```

---

## 📦 Release Notes

### 1.2.0

- ✨ **NEW**: Added `runScriptsInSelectedModules` which runs a group of predefined scripts in selected modules
- ✨ **NEW**: Added `stopScriptsInSelectedModules` which stops a group of predefined scripts in selected modules

### 1.1.0

- 🔧 Added `scriptModules` support for running npm scripts from multiple projects
- 🔧 Added `stopScriptInModule` command to stop running script terminals
- 🔧 Added support for external command files via `location` property
- 🔧 Implemented automatic configuration reload
- 🔧 Improved error handling for file operations
- 🔧 Enhanced keyboard shortcuts support
- 📝 Updated documentation with comprehensive examples

### 1.0.0

- 🎉 Initial public version
- ⚡ Start/stop commands for individual terminals and groups
- 🖱️ Multi-select interface for batch operations
- 📝 Support for multiple commands per terminal executed in sequence
