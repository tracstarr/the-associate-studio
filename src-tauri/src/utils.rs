/// Creates a `Command` that will not spawn a visible console window on Windows.
///
/// On Windows, `std::process::Command` spawns with `CREATE_NEW_CONSOLE` by default
/// when called from a GUI process, causing a brief cmd.exe window to flash on screen.
/// Setting `CREATE_NO_WINDOW` (0x08000000) suppresses that entirely.
pub fn silent_command(program: &str) -> std::process::Command {
    let mut cmd = std::process::Command::new(program);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}
