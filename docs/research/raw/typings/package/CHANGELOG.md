# CHANGELOG

## 6.64.0

- Now resolves to `@obsidian-typings/obsidian-public-latest` `^6.64.0`, which resolves to `@obsidian-typings/obsidian-public-1.15.1` `^1.5.0`. See [its release notes](https://github.com/obsidian-typings/obsidian-typings/releases/tag/obsidian-public-1.15.1-v1.5.0).

## 6.63.0

- Now resolves to `@obsidian-typings/obsidian-public-latest` `^6.63.0`, which resolves to `@obsidian-typings/obsidian-public-1.15.1` `^1.4.0`. See [its release notes](https://github.com/obsidian-typings/obsidian-typings/releases/tag/obsidian-public-1.15.1-v1.4.0).

## 6.61.0

- Now resolves to `@obsidian-typings/obsidian-public-latest` `^6.61.0`, which resolves to `@obsidian-typings/obsidian-public-1.15.1` `^1.2.0`. See [its release notes](https://github.com/obsidian-typings/obsidian-typings/releases/tag/obsidian-public-1.15.1-v1.2.0).

### Breaking changes in that release

- feat(workspace): type the members unset before the layout loads as nullable, with a LayoutReadyWorkspace view
- fix(workspace): correct members whose declared type disagrees with the 1.15.1 runtime
- fix(embed-registry): let EmbedCreator decline a file and loadFile be async

## 6.60.0

- Now resolves to `@obsidian-typings/obsidian-public-latest` `^6.60.0`, which resolves to `@obsidian-typings/obsidian-public-1.15.1` `^1.1.0`. See [its release notes](https://github.com/obsidian-typings/obsidian-typings/releases/tag/obsidian-public-1.15.1-v1.1.0).

### Breaking changes in that release

- fix!: move the Lezer and CodeMirror language/search boundaries behind an opt-in /lezer subpath
- fix(hotkey-manager)!: type save and load as returning Promise<void>
- feat(runtime)!: model the Obsidian catalyst 1.15.1 runtime changes
- fix(pdfjs)!: match the vendored PDF.js page and render task
- fix(bases)!: type the Bases file view controller as QueryController

## 6.59.0

- Now resolves to `@obsidian-typings/obsidian-public-latest` `^6.59.0`, which resolves to `@obsidian-typings/obsidian-public-1.15.0` `^1.1.0`. See [its release notes](https://github.com/obsidian-typings/obsidian-typings/releases/tag/obsidian-public-1.15.0-v1.1.0).

### Breaking changes in that release

- fix(bases)!: remove obsolete function types; use FormulaFunction

## 6.58.0

- Now resolves to `@obsidian-typings/obsidian-public-latest` `^6.58.0`, which resolves to `@obsidian-typings/obsidian-public-1.14.5` `^1.6.0`. See [its release notes](https://github.com/obsidian-typings/obsidian-typings/releases/tag/obsidian-public-1.14.5-v1.6.0).

### Breaking changes in that release

- fix!: use upstream Lezer and CodeMirror type identities
- feat(bases): type the formula functions that Plugin.registerGlobalFunc and registerInstanceFunc take

## 6.57.0

- Now resolves to `@obsidian-typings/obsidian-public-latest` `^6.57.0`, which resolves to `@obsidian-typings/obsidian-public-1.14.5` `^1.5.0`. See [its release notes](https://github.com/obsidian-typings/obsidian-typings/releases/tag/obsidian-public-1.14.5-v1.5.0).

## 6.56.0

- Now resolves to `@obsidian-typings/obsidian-public-latest` `^6.56.0`, which resolves to `@obsidian-typings/obsidian-public-1.14.5` `^1.4.0`. See [its release notes](https://github.com/obsidian-typings/obsidian-typings/releases/tag/obsidian-public-1.14.5-v1.4.0).

### Breaking changes in that release

- fix(bases): type BasesView group methods on BasesEntryGroup

## 6.55.0

- Now resolves to `@obsidian-typings/obsidian-public-latest` `^6.55.0`, which resolves to `@obsidian-typings/obsidian-public-1.14.5` `^1.3.0`. See [its release notes](https://github.com/obsidian-typings/obsidian-typings/releases/tag/obsidian-public-1.14.5-v1.3.0).

### Breaking changes in that release

- feat: declare the markdown editor view constructors
- fix: type Vault.appendBinary as taking a TFile, as Obsidian does

## 6.54.0

- Now resolves to `@obsidian-typings/obsidian-public-latest` `^6.54.0`, which resolves to `@obsidian-typings/obsidian-public-1.14.5` `^1.2.0`. See [its release notes](https://github.com/obsidian-typings/obsidian-typings/releases/tag/obsidian-public-1.14.5-v1.2.0).

### Breaking changes in that release

- fix(editable-file-view): type saveTitle as resolving a boolean
- fix(types)!: remove Modal.shouldAnimate, renamed to shouldAnimateOpen in 1.14.0
- fix: type the hotkey conflict map and correct the canvas edge multimaps

## 6.53.0

- Now resolves to `@obsidian-typings/obsidian-public-latest` `^6.53.0`, which resolves to `@obsidian-typings/obsidian-public-1.14.5` `^1.1.0`. See [its release notes](https://github.com/obsidian-typings/obsidian-typings/releases/tag/obsidian-public-1.14.5-v1.1.0).

### Breaking changes in that release

- fix(types): reconcile the extra 1.14.4 crawler findings
- fix(types): reconcile Obsidian 1.14.4 modal, file, workspace and adapter APIs

## 6.52.0

- Now resolves to `@obsidian-typings/obsidian-public-latest` `^6.52.0`, which resolves to `@obsidian-typings/obsidian-public-1.14.4` `^1.15.0`. See [its release notes](https://github.com/obsidian-typings/obsidian-typings/releases/tag/obsidian-public-1.14.4-v1.15.0).

### Breaking changes in that release

- fix!: remove obsolete protocol action trust declarations

## 6.51.0

- Now resolves to `@obsidian-typings/obsidian-public-latest` `^6.51.0`, which resolves to `@obsidian-typings/obsidian-public-1.14.4` `^1.14.0`. See [its release notes](https://github.com/obsidian-typings/obsidian-typings/releases/tag/obsidian-public-1.14.4-v1.14.0).

### Breaking changes in that release

- fix(metadata-cache): type updateInternalLinks as taking a CustomArrayDict
- fix(hotkey-manager): type the stored hotkeys as Hotkey, not KeymapInfo

## 6.50.0

- Now resolves to `@obsidian-typings/obsidian-public-latest` `^6.50.0`, which resolves to `@obsidian-typings/obsidian-public-1.14.4` `^1.13.0`. See [its release notes](https://github.com/obsidian-typings/obsidian-typings/releases/tag/obsidian-public-1.14.4-v1.13.0).

### Breaking changes in that release

- fix(read-view-renderer): add header, footer, sizerEl and the section API
- fix(file-explorer): type getSortedFolderItems as returning folder rows too
- fix(file-explorer): type a folder row's file as TFolder

## 6.49.0

- Now resolves to `@obsidian-typings/obsidian-public-latest` `^6.49.0`, which resolves to `@obsidian-typings/obsidian-public-1.14.4` `^1.12.0`. See [its release notes](https://github.com/obsidian-typings/obsidian-typings/releases/tag/obsidian-public-1.14.4-v1.12.0).

### Breaking changes in that release

- fix(app): type ImportedAttachment as Obsidian builds it, and importAttachments as returning files

## 6.48.0

- Now resolves to `@obsidian-typings/obsidian-public-latest` `^6.48.0`, which resolves to `@obsidian-typings/obsidian-public-1.14.4` `^1.11.0`. See [its release notes](https://github.com/obsidian-typings/obsidian-typings/releases/tag/obsidian-public-1.14.4-v1.11.0).

### Breaking changes in that release

- fix(result-dom): widen ResultProperty.subkey to (number | string)[]
- fix(types): make every ResultDomResult member optional, and add the search match keys
- fix(types): let App.changeTheme take 'system', and drop App.setTheme's parameter

## 6.47.0

- Now resolves to `@obsidian-typings/obsidian-public-latest` `^6.47.0`, which resolves to `@obsidian-typings/obsidian-public-1.14.4` `^1.10.0`. See [its release notes](https://github.com/obsidian-typings/obsidian-typings/releases/tag/obsidian-public-1.14.4-v1.10.0).

## 6.46.0

- Now resolves to `@obsidian-typings/obsidian-public-latest` `^6.46.0`, which resolves to `@obsidian-typings/obsidian-public-1.14.4` `^1.8.0`. See [its release notes](https://github.com/obsidian-typings/obsidian-typings/releases/tag/obsidian-public-1.14.4-v1.8.0).

### Breaking changes in that release

- feat: type ephemeral-state subpath, MarkdownView state, the property-value suggest and IPC toggles

## 6.45.0

- Now resolves to `@obsidian-typings/obsidian-public-latest` `^6.45.0`, which resolves to `@obsidian-typings/obsidian-public-1.14.4` `^1.7.0`. See [its release notes](https://github.com/obsidian-typings/obsidian-typings/releases/tag/obsidian-public-1.14.4-v1.7.0).

### Breaking changes in that release

- fix(result-dom): make ResultProperty.pos and subkey optional, and type ResultDomItem's rows

## 6.44.0

- Now resolves to `@obsidian-typings/obsidian-public-latest` `^6.44.0`, which resolves to `@obsidian-typings/obsidian-public-1.14.4` `^1.6.0`. See [its release notes](https://github.com/obsidian-typings/obsidian-typings/releases/tag/obsidian-public-1.14.4-v1.6.0).

### Breaking changes in that release

- feat: type vault config reads by key, and the appearance config file

## 6.43.0

- Now resolves to `@obsidian-typings/obsidian-public-latest` `^6.43.0`, which resolves to `@obsidian-typings/obsidian-public-1.14.4` `^1.5.0`. See [its release notes](https://github.com/obsidian-typings/obsidian-typings/releases/tag/obsidian-public-1.14.4-v1.5.0).

## 6.42.0

- Now resolves to `@obsidian-typings/obsidian-public-latest` `^6.42.0`, which resolves to `@obsidian-typings/obsidian-public-1.14.4` `^1.4.0`. See [its release notes](https://github.com/obsidian-typings/obsidian-typings/releases/tag/obsidian-public-1.14.4-v1.4.0).

## 6.41.0

- Now resolves to `@obsidian-typings/obsidian-public-latest` `^6.41.0`, which resolves to `@obsidian-typings/obsidian-public-1.14.4` `^1.3.0`. See [its release notes](https://github.com/obsidian-typings/obsidian-typings/releases/tag/obsidian-public-1.14.4-v1.3.0).

### Breaking changes in that release

- fix!: drop the Bases function registry that 1.14.4 no longer has

## 6.40.0

- Now resolves to `@obsidian-typings/obsidian-public-latest` `^6.40.0`, which resolves to `@obsidian-typings/obsidian-public-1.14.4` `^1.2.0`. See [its release notes](https://github.com/obsidian-typings/obsidian-typings/releases/tag/obsidian-public-1.14.4-v1.2.0).

### Breaking changes in that release

- fix(bases): drop the TableView workspace view and type the view registrations as they are

## 6.39.0

- Now resolves to `@obsidian-typings/obsidian-public-latest` `^6.39.0`, which resolves to `@obsidian-typings/obsidian-public-1.14.4` `^1.1.0`. See [its release notes](https://github.com/obsidian-typings/obsidian-typings/releases/tag/obsidian-public-1.14.4-v1.1.0).

## 6.38.0

- Now resolves to `@obsidian-typings/obsidian-public-latest` `^6.38.0`, which resolves to `@obsidian-typings/obsidian-public-1.13.7` `^1.11.0`. See [its release notes](https://github.com/obsidian-typings/obsidian-typings/releases/tag/obsidian-public-1.13.7-v1.11.0).

### Breaking changes in that release

- fix(plugins): enable/disablePlugin take the user flag, and both enable paths return boolean
- fix(metadata-cache): iterateRefsForFile takes a TFile and a predicate over Reference
- fix(file-manager): drop iterateAllRefs, which has no runtime implementation
- fix(app): getSpellcheckLanguages returns null, so widen its declared return
