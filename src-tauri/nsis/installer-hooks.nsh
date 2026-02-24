; Tauri NSIS installer hooks for The Associate Studio.
;
; NSIS_HOOK_PREUNINSTALL runs before the uninstaller removes any files,
; while the app binary is still present on disk. We call the app with
; --cleanup so it can remove Claude Code hooks, the theassociate data
; directory, app settings, and stored credentials.

!macro NSIS_HOOK_PREINSTALL
!macroend

!macro NSIS_HOOK_POSTINSTALL
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ExecWait '"$INSTDIR\the-associate-studio.exe" --cleanup' $0
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
!macroend
