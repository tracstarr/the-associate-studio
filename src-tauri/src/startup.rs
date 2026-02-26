/// Creates a Start Menu shortcut for the app with `System.AppUserModel.ID` set
/// so that Windows toast notifications show as "The Associate Studio" rather
/// than PowerShell. Idempotent — silently skips if the shortcut already exists.
pub fn ensure_start_menu_shortcut() {
    #[cfg(target_os = "windows")]
    unsafe {
        if let Err(e) = create_shortcut() {
            eprintln!("[ide] start menu shortcut: {e:?}");
        }
    }
}

#[cfg(target_os = "windows")]
unsafe fn create_shortcut() -> windows::core::Result<()> {
    use windows::{
        core::{Interface, GUID, HSTRING},
        Win32::System::Com::{
            CoCreateInstance, CoInitializeEx, CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED,
            IPersistFile, StructuredStorage::PROPVARIANT,
        },
        Win32::Foundation::PROPERTYKEY,
        Win32::UI::Shell::{
            IShellLinkW, ShellLink,
            PropertiesSystem::IPropertyStore,
        },
    };

    let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);

    // Resolve %APPDATA%\Microsoft\Windows\Start Menu\Programs\
    let Ok(appdata) = std::env::var("APPDATA") else {
        return Ok(());
    };
    let shortcut_path = format!(
        "{}\\Microsoft\\Windows\\Start Menu\\Programs\\The Associate Studio.lnk",
        appdata
    );

    // Already created on a previous launch — nothing to do.
    if std::path::Path::new(&shortcut_path).exists() {
        return Ok(());
    }

    let Ok(exe) = std::env::current_exe() else {
        return Ok(());
    };

    // Create an IShellLink pointing at the current executable.
    let link: IShellLinkW = CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER)?;
    link.SetPath(&HSTRING::from(exe.to_string_lossy().as_ref()))?;

    // Set PKEY_AppUserModel_ID = {9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3}, pid=5
    let pkey = PROPERTYKEY {
        fmtid: GUID {
            data1: 0x9F4C2855,
            data2: 0x9F79,
            data3: 0x4B39,
            data4: [0xA8, 0xD0, 0xE1, 0xD4, 0x2D, 0xE1, 0xD5, 0xF3],
        },
        pid: 5,
    };

    // Build a VT_LPWSTR (31) PROPVARIANT at the byte level.
    // 64-bit layout: [0..2] vt=31, [2..8] reserved, [8..16] pwszVal pointer.
    let mut aumid: Vec<u16> = "com.keith.the-associate-studio\0"
        .encode_utf16()
        .collect();
    let mut pv = PROPVARIANT::default();
    let base = std::ptr::addr_of_mut!(pv) as *mut u8;
    *(base as *mut u16) = 31u16; // VT_LPWSTR
    *(base.add(8) as *mut *mut u16) = aumid.as_mut_ptr();

    let store: IPropertyStore = link.cast()?;
    store.SetValue(&pkey, &pv)?;
    store.Commit()?;

    // Persist the .lnk file.
    let persist: IPersistFile = link.cast()?;
    persist.Save(&HSTRING::from(shortcut_path.as_str()), true)?;

    Ok(())
}
