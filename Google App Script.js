function doPost(e) {
  // Setup output JSON
  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  
  try {
    // Parse data yang dikirim dari Frontend (HTML)
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    
    // Buka Spreadsheet aktif
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // ==========================================
    // 1. REGISTER (DAFTAR AKUN BARU)
    // ==========================================
    if (action === 'register_user') {
      var sheetUsers = ss.getSheetByName("Users");
      if (!sheetUsers) return output.setContent(JSON.stringify({ "status": "error", "message": "Sheet 'Users' tidak ditemukan." }));
      
      var userList = sheetUsers.getDataRange().getValues();
      
      // Cek apakah nomor WA sudah terdaftar
      for (var i = 1; i < userList.length; i++) {
        if (userList[i][3] == data.wa) { 
          return output.setContent(JSON.stringify({ "status": "error", "message": "Nomor WhatsApp sudah terdaftar." }));
        }
      }
      
      // Buat ID unik berdasarkan waktu
      var prefix = data.role === 'Merchant' ? 'M-' : 'D-';
      var newUserId = prefix + new Date().getTime().toString().slice(-6);
      
      // Tentukan status akun (Driver butuh verifikasi, Merchant langsung aktif)
      var statusAkun = data.role === 'Driver' ? 'Pending' : 'Aktif';
      
      // Simpan ke Sheet Users (ID, Role, Nama, WA, Password, Status)
      sheetUsers.appendRow([newUserId, data.role, data.nama, data.wa, data.password, statusAkun]);
      
      return output.setContent(JSON.stringify({
        "status": "success",
        "message": "Pendaftaran berhasil!",
        "statusAkun": statusAkun,
        "user": {
          "userId": newUserId,
          "role": data.role,
          "nama": data.nama,
          "wa": data.wa
        }
      }));
    }

    // ==========================================
    // 2. LOGIN (MASUK AKUN)
    // ==========================================
    else if (action === 'login') {
      var sheetUsers = ss.getSheetByName("Users");
      if (!sheetUsers) return output.setContent(JSON.stringify({ "status": "error", "message": "Sheet 'Users' tidak ditemukan." }));
      
      var userList = sheetUsers.getDataRange().getValues();
      
      for (var i = 1; i < userList.length; i++) {
        // Cek WA dan Password
        if (userList[i][3] == data.wa && userList[i][4] == data.password) {
          
          // Cek jika status akun masih Pending (khusus Driver)
          if (userList[i][5] === 'Pending') {
            return output.setContent(JSON.stringify({ "status": "error", "message": "Akun Anda masih menunggu verifikasi Admin." }));
          }
          
          return output.setContent(JSON.stringify({
            "status": "success",
            "message": "Berhasil masuk!",
            "user": {
              "userId": userList[i][0],
              "role": userList[i][1],
              "nama": userList[i][2],
              "wa": userList[i][3]
            }
          }));
        }
      }
      return output.setContent(JSON.stringify({ "status": "error", "message": "Nomor WA atau Password salah." }));
    }

    // ==========================================
    // 3. EDIT USER (UBAH PROFIL PRIBADI)
    // ==========================================
    else if (action === 'edit_user') {
      var sheetUsers = ss.getSheetByName("Users");
      if (!sheetUsers) return output.setContent(JSON.stringify({ "status": "error", "message": "Sheet 'Users' tidak ditemukan." }));
      
      var userList = sheetUsers.getDataRange().getValues();
      
      // Validasi jika WA diubah, apakah sudah dipakai orang lain?
      if (data.newWa !== data.oldWa) {
        for (var j = 1; j < userList.length; j++) {
          if (userList[j][3] == data.newWa && userList[j][0] != data.userId) {
            return output.setContent(JSON.stringify({ "status": "error", "message": "Nomor WhatsApp baru sudah terdaftar di akun lain." }));
          }
        }
      }
      
      for (var i = 1; i < userList.length; i++) {
        if (userList[i][0] == data.userId) {
          // Cek password lama jika user ingin ubah password
          if (data.newPassword && data.newPassword !== "") {
            if (userList[i][4] != data.oldPassword) {
              return output.setContent(JSON.stringify({ "status": "error", "message": "Kata sandi saat ini salah." }));
            }
            sheetUsers.getRange(i + 1, 5).setValue(data.newPassword);
          }
          
          // Update Nama dan WA
          sheetUsers.getRange(i + 1, 3).setValue(data.nama);
          sheetUsers.getRange(i + 1, 4).setValue(data.newWa);
          
          return output.setContent(JSON.stringify({
            "status": "success",
            "message": "Profil berhasil diperbarui!",
            "user": {
              "userId": data.userId,
              "role": userList[i][1],
              "nama": data.nama,
              "wa": data.newWa
            }
          }));
        }
      }
      return output.setContent(JSON.stringify({ "status": "error", "message": "Pengguna tidak ditemukan." }));
    }

    // ==========================================
    // 4. GET TOKO INFO (AMBIL DATA TOKO)
    // ==========================================
    else if (action === 'get_toko_info') {
      var sheetToko = ss.getSheetByName("Toko");
      if (!sheetToko) return output.setContent(JSON.stringify({ "status": "success", "toko": null })); // Tidak error, anggap saja belum ada
      
      var tokoList = sheetToko.getDataRange().getValues();
      for (var i = 1; i < tokoList.length; i++) {
        if (tokoList[i][0] == data.userId) { 
           return output.setContent(JSON.stringify({ 
             "status": "success", 
             "toko": { 
               "namaToko": tokoList[i][1], 
               "jamBuka": tokoList[i][2], 
               "alamat": tokoList[i][3],
               "kordinat": tokoList[i][4] || "" 
             }
           }));
        }
      }
      // Jika loop selesai dan tidak ketemu
      return output.setContent(JSON.stringify({ "status": "success", "toko": null }));
    }

    // ==========================================
    // 5. EDIT TOKO INFO (UBAH/TAMBAH DATA TOKO)
    // ==========================================
    else if (action === 'edit_toko_info') {
      var sheetToko = ss.getSheetByName("Toko");
      if (!sheetToko) {
        return output.setContent(JSON.stringify({ "status": "error", "message": "Sheet 'Toko' tidak ditemukan. Harap buat sheet bernama Toko." }));
      }

      var tokoData = sheetToko.getDataRange().getValues();
      var isFound = false;

      // Cari berdasarkan UserId
      for (var i = 1; i < tokoData.length; i++) {
        if (tokoData[i][0] == data.userId) { 
          // Jika ketemu -> UPDATE
          sheetToko.getRange(i + 1, 2).setValue(data.namaToko); 
          sheetToko.getRange(i + 1, 3).setValue(data.jamBuka);  
          sheetToko.getRange(i + 1, 4).setValue(data.alamat);   
          sheetToko.getRange(i + 1, 5).setValue(data.kordinat); 
          isFound = true;
          break;
        }
      }

      // Jika belum ada di database (Merchant baru) -> BUAT BARIS BARU
      if (!isFound) {
        sheetToko.appendRow([
          data.userId, 
          data.namaToko, 
          data.jamBuka, 
          data.alamat, 
          data.kordinat
        ]);
      }

      return output.setContent(JSON.stringify({ "status": "success", "message": "Informasi toko berhasil disimpan!" }));
    }
    
    // Default Fallback
    return output.setContent(JSON.stringify({ "status": "error", "message": "Aksi tidak dikenali." }));

  } catch (error) {
    // Tangkap error sistem
    return output.setContent(JSON.stringify({ "status": "error", "message": "Terjadi kesalahan server: " + error.message }));
  }
}