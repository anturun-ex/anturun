const SHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

function doPost(e) {
  const sheet = SpreadsheetApp.openById(SHEET_ID);
  const response = { status: 'error', message: 'Unknown error' };

  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;

    // ==========================================
    // 1. AUTH & PROFIL (Bawaan Lama)
    // ==========================================
    if (action === 'login') {
      const wsUsers = sheet.getSheetByName("Users");
      const data = wsUsers.getDataRange().getValues();
      let found = false;

      for (let i = 1; i < data.length; i++) {
        if (data[i][2].toString() === payload.wa && data[i][3].toString() === payload.password) {
          found = true;
          if (data[i][5] === 'Pending') {
            response.status = 'success';
            response.statusAkun = 'Pending';
          } else {
            response.status = 'success';
            response.message = 'Login berhasil!';
            response.user = { userId: data[i][0], role: data[i][1], wa: data[i][2], nama: data[i][4] };
          }
          break;
        }
      }
      if (!found) response.message = 'Nomor WA atau Password salah.';
    } 
    
    else if (action === 'register_user') {
      const wsUsers = sheet.getSheetByName("Users");
      const data = wsUsers.getDataRange().getValues();
      let exists = false;

      for (let i = 1; i < data.length; i++) {
        if (data[i][2].toString() === payload.wa) { exists = true; break; }
      }

      if (exists) {
        response.message = 'Nomor WA sudah terdaftar!';
      } else {
        const newId = 'USR-' + new Date().getTime();
        const statusAkun = payload.role === 'Driver' ? 'Pending' : 'Active';
        wsUsers.appendRow([newId, payload.role, payload.wa, payload.password, payload.nama, statusAkun]);
        
        response.status = 'success';
        response.statusAkun = statusAkun;
        response.message = 'Pendaftaran berhasil!';
        response.user = { userId: newId, role: payload.role, wa: payload.wa, nama: payload.nama };
      }
    }

    else if (action === 'edit_user') {
      const wsUsers = sheet.getSheetByName("Users");
      const data = wsUsers.getDataRange().getValues();
      let updated = false;

      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === payload.userId) {
          if (payload.oldPassword && payload.newPassword) {
             if (data[i][3].toString() !== payload.oldPassword) {
                response.message = 'Kata sandi saat ini salah!';
                return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);
             }
             wsUsers.getRange(i + 1, 4).setValue(payload.newPassword);
          }
          wsUsers.getRange(i + 1, 3).setValue(payload.newWa);
          wsUsers.getRange(i + 1, 5).setValue(payload.nama);
          
          updated = true;
          response.status = 'success';
          response.message = 'Profil berhasil diperbarui!';
          response.user = { userId: payload.userId, role: data[i][1], wa: payload.newWa, nama: payload.nama };
          break;
        }
      }
      if (!updated) response.message = 'Pengguna tidak ditemukan.';
    }

    // ==========================================
    // 2. MANAJEMEN TOKO
    // ==========================================
    else if (action === 'get_toko_info') {
      const wsToko = sheet.getSheetByName("Toko");
      const data = wsToko.getDataRange().getValues();
      let tokoData = null;

      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === payload.userId) {
          tokoData = { 
            namaToko: data[i][1], 
            jamBuka: data[i][2], 
            alamat: data[i][3], 
            kordinat: data[i][4],
            statusToko: data[i][5] || 'Tutup' // Default Tutup jika kosong
          };
          break;
        }
      }

      response.status = 'success';
      response.toko = tokoData;
    }

    else if (action === 'edit_toko_info') {
      const wsToko = sheet.getSheetByName("Toko");
      const data = wsToko.getDataRange().getValues();
      let foundRow = -1;

      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === payload.userId) { foundRow = i + 1; break; }
      }

      if (foundRow > -1) {
        wsToko.getRange(foundRow, 2).setValue(payload.namaToko);
        wsToko.getRange(foundRow, 3).setValue(payload.jamBuka);
        wsToko.getRange(foundRow, 4).setValue(payload.alamat);
        wsToko.getRange(foundRow, 5).setValue(payload.kordinat);
      } else {
        // Jika belum ada, buat baru. Kolom F (statusToko) default 'Tutup'
        wsToko.appendRow([payload.userId, payload.namaToko, payload.jamBuka, payload.alamat, payload.kordinat, 'Tutup']);
      }
      response.status = 'success';
      response.message = 'Informasi toko berhasil disimpan!';
    }
    
    else if (action === 'set_store_status') {
      const wsToko = sheet.getSheetByName("Toko");
      const data = wsToko.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === payload.userId) { 
          wsToko.getRange(i + 1, 6).setValue(payload.statusToko ? 'Buka' : 'Tutup');
          response.status = 'success';
          break; 
        }
      }
    }

    // ==========================================
    // 3. MANAJEMEN DAFTAR MENU
    // ==========================================
    else if (action === 'get_menus') {
      const wsMenu = sheet.getSheetByName("Menu");
      const data = wsMenu.getDataRange().getValues();
      let menus = [];

      for (let i = 1; i < data.length; i++) {
        if (data[i][1] === payload.userId) {
          menus.push({
            id: data[i][0],
            nama: data[i][2],
            harga: data[i][3],
            desc: data[i][4],
            aktif: data[i][5] === true || data[i][5] === 'TRUE' || data[i][5] === true
          });
        }
      }
      
      // Urutkan menu terbaru di atas
      menus.reverse();
      response.status = 'success';
      response.menus = menus;
    }

    else if (action === 'save_menu') {
      const wsMenu = sheet.getSheetByName("Menu");
      
      if (payload.menuId) {
        // Edit Menu
        const data = wsMenu.getDataRange().getValues();
        for (let i = 1; i < data.length; i++) {
          if (data[i][0] === payload.menuId && data[i][1] === payload.userId) {
            wsMenu.getRange(i + 1, 3).setValue(payload.nama);
            wsMenu.getRange(i + 1, 4).setValue(payload.harga);
            wsMenu.getRange(i + 1, 5).setValue(payload.desc);
            response.status = 'success';
            response.message = 'Menu diperbarui';
            break;
          }
        }
      } else {
        // Tambah Menu Baru
        const newId = 'MNU-' + new Date().getTime();
        wsMenu.appendRow([newId, payload.userId, payload.nama, payload.harga, payload.desc, true]);
        response.status = 'success';
        response.message = 'Menu baru ditambahkan';
      }
    }

    else if (action === 'toggle_menu') {
      const wsMenu = sheet.getSheetByName("Menu");
      const data = wsMenu.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === payload.menuId && data[i][1] === payload.userId) {
          wsMenu.getRange(i + 1, 6).setValue(payload.aktif);
          response.status = 'success';
          break;
        }
      }
    }

    // ==========================================
    // 4. MANAJEMEN PESANAN & DASHBOARD
    // ==========================================
    else if (action === 'get_pesanan') {
      const wsPesanan = sheet.getSheetByName("Pesanan");
      const data = wsPesanan.getDataRange().getValues();
      let orders = [];

      // Loop dari bawah (terbaru) ke atas
      for (let i = data.length - 1; i >= 1; i--) {
        if (data[i][1] === payload.userId) {
          orders.push({
            id: data[i][0],
            customer: data[i][2],
            items: data[i][3],
            total: data[i][4],
            status: data[i][5],
            time: data[i][6],
            date: data[i][7], // Format string tgl, cth: '2023-10-01'
            note: data[i][8] || ''
          });
        }
      }
      response.status = 'success';
      response.orders = orders;
    }

    else if (action === 'update_pesanan_status') {
      const wsPesanan = sheet.getSheetByName("Pesanan");
      const data = wsPesanan.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === payload.orderId) {
          wsPesanan.getRange(i + 1, 6).setValue(payload.newStatus);
          response.status = 'success';
          break;
        }
      }
    }

  } catch (error) {
    response.message = error.toString();
  }

  return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);
}
