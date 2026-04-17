// ==============================================================================
// BACKEND GOOGLE APPS SCRIPT - ANTURUN APP
// ==============================================================================

// Buka Spreadsheet yang aktif (tempat script ini terpasang)
const ss = SpreadsheetApp.getActiveSpreadsheet();

// FUNGSI HELPER STANDARISASI NOMOR WA (Mencegah Bug Format WA Lama)
function formatWA(number) {
  if (!number) return "";
  let formatted = number.toString().replace(/\D/g, '');
  if (formatted.startsWith('0')) {
    formatted = '62' + formatted.substring(1);
  } else if (formatted.startsWith('8')) {
    formatted = '62' + formatted;
  }
  return formatted;
}

// Fungsi utama untuk menerima request POST dari aplikasi
function doPost(e) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  // Mencegah error CORS untuk request preflight
  if (!e || !e.postData || !e.postData.contents) {
    return output.setContent(JSON.stringify({ status: 'error', message: 'Tidak ada data yang dikirim.' }));
  }

  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    let result = {};

    // Routing (Mengarahkan request ke fungsi yang tepat berdasarkan 'action')
    switch (action) {
      case 'login':
        result = handleLogin(data);
        break;
      case 'register_user':
        result = handleRegister(data);
        break;
      case 'request_reset_otp':  // Endpoint baru untuk meminta OTP
        result = handleRequestResetOtp(data);
        break;
      case 'reset_password':     
        result = handleResetPassword(data);
        break;
      case 'edit_user':
        result = handleEditUser(data);
        break;
      case 'get_toko_info':
        result = handleGetToko(data);
        break;
      case 'edit_toko_info':
        result = handleEditToko(data);
        break;
      case 'set_store_status':
        result = handleSetStoreStatus(data);
        break;
      case 'get_menus':
        result = handleGetMenus(data);
        break;
      case 'save_menu':
        result = handleSaveMenu(data);
        break;
      case 'toggle_menu':
        result = handleToggleMenu(data);
        break;
      case 'delete_menu':
        result = handleDeleteMenu(data);
        break;
      case 'get_pesanan':
        result = handleGetPesanan(data);
        break;
      case 'update_pesanan_status':
        result = handleUpdatePesanan(data);
        break;
      default:
        result = { status: 'error', message: 'Aksi (' + action + ') tidak dikenali oleh server.' };
    }

    return output.setContent(JSON.stringify(result));

  } catch (error) {
    return output.setContent(JSON.stringify({ status: 'error', message: 'Terjadi kesalahan server: ' + error.toString() }));
  }
}

// ==============================================================================
// 1. FUNGSI AUTENTIKASI & AKUN PENGGUNA
// ==============================================================================

// FUNGSI HELPER UNTUK GOOGLE DRIVE FOLDER
function getOrCreateDriveFolder(folderName) {
  const folders = DriveApp.getFoldersByName(folderName);
  let folder;
  if (folders.hasNext()) {
    folder = folders.next();
  } else {
    folder = DriveApp.createFolder(folderName);
  }
  // Pastikan folder bisa dilihat oleh siapa saja (Anyone with link) agar gambar muncul di HTML
  folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return folder;
}

function getOrCreateSheet(sheetName) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    // Setup header default jika sheet baru
    if(sheetName === "Users") sheet.appendRow(["ID", "Nama", "WA", "Password", "Role", "StatusAkun"]);
    if(sheetName === "OTP_Requests") sheet.appendRow(["WA", "OTP", "ExpiryTime"]); // Tambahan Sheet OTP
    if(sheetName === "Toko") sheet.appendRow(["UserID", "NamaToko", "JamBuka", "Alamat", "Kordinat", "StatusToko"]);
    if(sheetName === "Menu") sheet.appendRow(["MenuID", "UserID", "NamaMenu", "Harga", "Deskripsi", "Aktif", "ImageURL"]);
    if(sheetName === "Pesanan") sheet.appendRow(["OrderID", "UserID", "Customer", "Waktu", "Items", "Total", "Status", "Note", "Date"]);
  }
  return sheet;
}

function handleLogin(data) {
  const sheet = getOrCreateSheet("Users");
  const values = sheet.getDataRange().getValues();
  const incomingWa = formatWA(data.wa); 
  
  for (let i = 1; i < values.length; i++) {
    if (formatWA(values[i][2]) === incomingWa) {
      if (values[i][3].toString() === data.password.toString()) {
        return {
          status: 'success',
          user: {
            userId: values[i][0],
            nama: values[i][1],
            wa: formatWA(values[i][2]), 
            role: values[i][4]
          }
        };
      } else {
        return { status: 'error', message: 'Kata sandi yang Anda masukkan salah.' };
      }
    }
  }
  return { status: 'error', message: 'Nomor WhatsApp belum terdaftar.' };
}

function handleRegister(data) {
  const sheet = getOrCreateSheet("Users");
  const values = sheet.getDataRange().getValues();
  const incomingWa = formatWA(data.wa);
  
  for (let i = 1; i < values.length; i++) {
    if (formatWA(values[i][2]) === incomingWa) {
      return { status: 'error', message: 'Nomor WhatsApp sudah digunakan.' };
    }
  }

  const newId = 'USR' + new Date().getTime();
  const statusAkun = data.role === 'Driver' ? 'Pending' : 'Active';
  
  sheet.appendRow([newId, data.nama, incomingWa, data.password, data.role, statusAkun]);
  
  return {
    status: 'success',
    statusAkun: statusAkun,
    user: { userId: newId, nama: data.nama, wa: incomingWa, role: data.role }
  };
}

// ==============================================================================
// LOGIKA RESET PASSWORD & OTP
// ==============================================================================

function handleRequestResetOtp(data) {
  const incomingWa = formatWA(data.wa);
  
  // 1. Cek apakah WA terdaftar
  const usersSheet = getOrCreateSheet("Users");
  const usersData = usersSheet.getDataRange().getValues();
  let isRegistered = false;
  
  for (let i = 1; i < usersData.length; i++) {
    if (formatWA(usersData[i][2]) === incomingWa) {
      isRegistered = true;
      break;
    }
  }

  if (!isRegistered) {
    return { status: 'error', message: 'Nomor WhatsApp tidak terdaftar.' };
  }

  // 2. Buat OTP acak (6 digit) dan tentukan waktu kedaluwarsa (15 Menit - lebih lama karena manual)
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiryTime = new Date().getTime() + (15 * 60 * 1000); 

  // 3. Simpan di Sheet OTP_Requests
  const otpSheet = getOrCreateSheet("OTP_Requests");
  const otpData = otpSheet.getDataRange().getValues();
  let updated = false;

  for (let i = 1; i < otpData.length; i++) {
    if (formatWA(otpData[i][0]) === incomingWa) {
      // Update jika user meminta lagi
      otpSheet.getRange(i + 1, 2).setValue(otp);
      otpSheet.getRange(i + 1, 3).setValue(expiryTime);
      updated = true;
      break;
    }
  }

  if (!updated) {
    otpSheet.appendRow([incomingWa, otp, expiryTime]);
  }

  // Karena permintaan OTP manual, kita tidak mengirim API ke WA otomatis.
  // Admin akan membuka sheet "OTP_Requests" secara manual saat dihubungi user.
  
  return { status: 'success', message: 'Kode OTP telah dibuat di sistem. Silakan hubungi admin.' };
}

function handleResetPassword(data) {
  const incomingWa = formatWA(data.wa);
  const incomingOtp = data.otp;

  if (!incomingOtp) {
    return { status: 'error', message: 'Kode OTP tidak boleh kosong.' };
  }

  // 1. Verifikasi OTP
  const otpSheet = getOrCreateSheet("OTP_Requests");
  const otpData = otpSheet.getDataRange().getValues();
  let isValidOtp = false;

  for (let i = 1; i < otpData.length; i++) {
    if (formatWA(otpData[i][0]) === incomingWa) {
      const storedOtp = otpData[i][1].toString();
      const expiryTime = parseInt(otpData[i][2]);
      const currentTime = new Date().getTime();

      if (storedOtp === incomingOtp.toString()) {
        if (currentTime <= expiryTime) {
          isValidOtp = true;
          // Kosongkan OTP agar tidak bisa dipakai 2 kali
          otpSheet.getRange(i + 1, 2).setValue("");
          otpSheet.getRange(i + 1, 3).setValue("");
        } else {
          return { status: 'error', message: 'Kode OTP sudah kedaluwarsa. Silakan minta ulang.' };
        }
      }
      break;
    }
  }

  if (!isValidOtp) {
    return { status: 'error', message: 'Kode OTP yang Anda masukkan salah.' };
  }

  // 2. Jika valid, update Password di Sheet Users
  const sheet = getOrCreateSheet("Users");
  const values = sheet.getDataRange().getValues();
  
  for (let i = 1; i < values.length; i++) {
    if (formatWA(values[i][2]) === incomingWa) {
      sheet.getRange(i + 1, 4).setValue(data.newPassword);
      return { status: 'success', message: 'Kata sandi berhasil direset.' };
    }
  }
  
  return { status: 'error', message: 'Terjadi kesalahan. Nomor WhatsApp tidak ditemukan saat proses pembaruan.' };
}

// ==============================================================================

function handleEditUser(data) {
  const sheet = getOrCreateSheet("Users");
  const values = sheet.getDataRange().getValues();
  const incomingNewWa = formatWA(data.newWa);
  
  for (let i = 1; i < values.length; i++) {
    if (values[i][0].toString() === data.userId.toString()) {
      
      // Update Nama dan WA
      sheet.getRange(i + 1, 2).setValue(data.nama); 
      sheet.getRange(i + 1, 3).setValue(incomingNewWa);

      // Jika user mengisi password baru
      if (data.newPassword && data.newPassword !== "") {
        if (values[i][3].toString() !== data.oldPassword.toString()) {
            return { status: 'error', message: 'Kata sandi lama yang dimasukkan tidak sesuai.' };
        }
        sheet.getRange(i + 1, 4).setValue(data.newPassword); 
      }

      return { 
        status: 'success', 
        message: 'Data profil berhasil diperbarui.',
        user: { userId: data.userId, nama: data.nama, wa: incomingNewWa, role: values[i][4] }
      };
    }
  }
  return { status: 'error', message: 'Data Pengguna tidak ditemukan.' };
}

// ==============================================================================
// 2. FUNGSI TOKO / MERCHANT
// ==============================================================================

function handleGetToko(data) {
  const sheet = getOrCreateSheet("Toko");
  const values = sheet.getDataRange().getValues();
  
  for (let i = 1; i < values.length; i++) {
    if (values[i][0].toString() === data.userId.toString()) {
      return {
        status: 'success',
        toko: {
          namaToko: values[i][1],
          jamBuka: values[i][2],
          alamat: values[i][3],
          kordinat: values[i][4],
          statusToko: values[i][5] || 'Tutup'
        }
      };
    }
  }
  return { status: 'success', toko: null }; // Toko belum diatur
}

function handleEditToko(data) {
  const sheet = getOrCreateSheet("Toko");
  const values = sheet.getDataRange().getValues();
  let isUpdated = false;

  for (let i = 1; i < values.length; i++) {
    if (values[i][0].toString() === data.userId.toString()) {
      sheet.getRange(i + 1, 2).setValue(data.namaToko);
      sheet.getRange(i + 1, 3).setValue(data.jamBuka);
      sheet.getRange(i + 1, 4).setValue(data.alamat);
      sheet.getRange(i + 1, 5).setValue(data.kordinat);
      isUpdated = true;
      break;
    }
  }

  // Jika user belum punya data toko, buat baru
  if (!isUpdated) {
    sheet.appendRow([data.userId, data.namaToko, data.jamBuka, data.alamat, data.kordinat, 'Tutup']);
  }

  return { status: 'success', message: 'Informasi Toko berhasil disimpan.' };
}

function handleSetStoreStatus(data) {
  const sheet = getOrCreateSheet("Toko");
  const values = sheet.getDataRange().getValues();
  const statusString = data.statusToko ? 'Buka' : 'Tutup';
  
  for (let i = 1; i < values.length; i++) {
    if (values[i][0].toString() === data.userId.toString()) {
      sheet.getRange(i + 1, 6).setValue(statusString);
      return { status: 'success', message: 'Status toko diubah menjadi ' + statusString };
    }
  }
  return { status: 'error', message: 'Toko belum diatur, silakan lengkapi profil toko terlebih dahulu.' };
}

// ==============================================================================
// 3. FUNGSI MENU
// ==============================================================================

function handleGetMenus(data) {
  const sheet = getOrCreateSheet("Menu");
  const values = sheet.getDataRange().getValues();
  const menus = [];

  for (let i = 1; i < values.length; i++) {
    if (values[i][1].toString() === data.userId.toString()) {
      menus.push({
        id: values[i][0],
        nama: values[i][2],
        harga: values[i][3],
        desc: values[i][4],
        aktif: values[i][5] === true || values[i][5] === "true" || values[i][5] === "TRUE",
        image: values[i][6] || ""
      });
    }
  }
  
  return { status: 'success', menus: menus };
}

function handleSaveMenu(data) {
  const sheet = getOrCreateSheet("Menu");
  let finalImageUrl = data.image || "";

  // JIKA GAMBAR BARU DIUNGGAH (FORMAT BASE64 DARI FRONTEND)
  if (finalImageUrl.startsWith("data:image")) {
    try {
      const folder = getOrCreateDriveFolder("Anturun_Menu_Images");
      const mimeString = finalImageUrl.split(';')[0]; // ex: "data:image/jpeg"
      const type = mimeString.split('/')[1]; // ex: "jpeg"
      const base64Data = finalImageUrl.split(',')[1]; // hapus header
      
      const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), 'image/' + type, "Menu_" + new Date().getTime() + "." + type);
      const file = folder.createFile(blob);
      
      // Menggunakan format URL langsung agar dapat di-render ke dalam tag <img> HTML
      finalImageUrl = "https://drive.google.com/uc?export=view&id=" + file.getId();
    } catch (e) {
      // Fallback: Jika gagal upload ke drive karena suatu hal, biarkan kosong
      finalImageUrl = "";
    }
  }
  
  // Update menu jika ID dikirim
  if (data.menuId && data.menuId !== "") {
    const values = sheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      if (values[i][0].toString() === data.menuId.toString()) {
        
        // Hapus gambar lama jika ada gambar baru yang diunggah
        const oldImageUrl = values[i][6];
        if (data.image && data.image.startsWith("data:image") && oldImageUrl && oldImageUrl.toString().includes("drive.google.com")) {
          try {
            const fileIdMatch = oldImageUrl.toString().match(/id=([a-zA-Z0-9_-]+)/);
            if (fileIdMatch && fileIdMatch[1]) {
              DriveApp.getFileById(fileIdMatch[1]).setTrashed(true);
            }
          } catch (e) {}
        }
        
        // Jika form tidak mengirim gambar baru, gunakan kembali gambar yang lama
        if (!data.image || data.image === "") {
          finalImageUrl = oldImageUrl || "";
        }

        sheet.getRange(i + 1, 3).setValue(data.nama);
        sheet.getRange(i + 1, 4).setValue(data.harga);
        sheet.getRange(i + 1, 5).setValue(data.desc);
        sheet.getRange(i + 1, 7).setValue(finalImageUrl); // Update Gambar di Kolom G
        return { status: 'success', message: 'Menu berhasil diperbarui.' };
      }
    }
  }
  
  // Buat menu baru jika tidak ada ID (Termasuk gambar URL Google Drive)
  const newMenuId = 'MNU' + new Date().getTime();
  sheet.appendRow([newMenuId, data.userId, data.nama, data.harga, data.desc, true, finalImageUrl]);
  
  return { status: 'success', message: 'Menu baru berhasil ditambahkan.' };
}

function handleToggleMenu(data) {
  const sheet = getOrCreateSheet("Menu");
  const values = sheet.getDataRange().getValues();
  
  for (let i = 1; i < values.length; i++) {
    if (values[i][0].toString() === data.menuId.toString()) {
      sheet.getRange(i + 1, 6).setValue(data.aktif);
      return { status: 'success', message: 'Status ketersediaan menu diperbarui.' };
    }
  }
  return { status: 'error', message: 'Menu tidak ditemukan.' };
}

// ==============================================================================
// FUNGSI HAPUS MENU
// ==============================================================================
function handleDeleteMenu(data) {
  const sheet = getOrCreateSheet("Menu");
  const values = sheet.getDataRange().getValues();
  
  // Looping mundur untuk menghindari pergeseran indeks saat menghapus baris
  for (let i = values.length - 1; i >= 1; i--) {
    if (values[i][0].toString() === data.menuId.toString() && values[i][1].toString() === data.userId.toString()) {
      
      // Hapus file gambar dari Google Drive jika ada
      const imageUrl = values[i][6];
      if (imageUrl && imageUrl.toString().includes("drive.google.com")) {
        try {
          const fileIdMatch = imageUrl.toString().match(/id=([a-zA-Z0-9_-]+)/);
          if (fileIdMatch && fileIdMatch[1]) {
            const file = DriveApp.getFileById(fileIdMatch[1]);
            file.setTrashed(true); // Memindahkan file ke Trash (Tempat Sampah) Google Drive
          }
        } catch (e) {
          // Lanjutkan proses menghapus data di Spreadsheet meskipun gagal menghapus dari Drive
        }
      }

      sheet.deleteRow(i + 1); // +1 karena getRange() mulai dari 1
      return { status: 'success', message: 'Menu dan gambar berhasil dihapus.' };
    }
  }
  return { status: 'error', message: 'Menu tidak ditemukan atau Anda tidak memiliki akses.' };
}

// ==============================================================================
// 4. FUNGSI PESANAN
// ==============================================================================

function handleGetPesanan(data) {
  const sheet = getOrCreateSheet("Pesanan");
  const values = sheet.getDataRange().getValues();
  const orders = [];

  for (let i = 1; i < values.length; i++) {
    // Cek apakah kolom UserID (Merchant) sesuai
    if (values[i][1].toString() === data.userId.toString()) {
      orders.push({
        id: values[i][0],
        customer: values[i][2],
        time: values[i][3],
        items: values[i][4],
        total: values[i][5],
        status: values[i][6],
        note: values[i][7],
        date: values[i][8] // YYYY-MM-DD
      });
    }
  }
  
  // Mengurutkan pesanan dari yang paling baru
  orders.reverse(); 

  return { status: 'success', orders: orders };
}

function handleUpdatePesanan(data) {
  const sheet = getOrCreateSheet("Pesanan");
  const values = sheet.getDataRange().getValues();
  
  for (let i = 1; i < values.length; i++) {
    if (values[i][0].toString() === data.orderId.toString()) {
      sheet.getRange(i + 1, 7).setValue(data.newStatus); // Kolom Status (G)
      return { status: 'success', message: 'Status pesanan berhasil diubah menjadi ' + data.newStatus };
    }
  }
  return { status: 'error', message: 'Pesanan tidak ditemukan.' };
}
