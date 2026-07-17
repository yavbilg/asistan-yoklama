// Bu kodu Google Apps Script editörüne yapıştırın
// https://script.google.com/u/0/home/projects/1sQJ6wxrm_WCSWz4XGNL0gGPwvLnkeTD6ARScqlyFmpIz2YTwYs8P61pU/edit

var SPREADSHEET_ID = "10FJ11WGIItPOaLiZLTfHjkYZPHKqnZLnn-_1SrhJY2g";

function doGet(e) {
  var action = e.parameter.action;

  if (action === "getSessions") {
    return getSessions();
  }

  return ContentService.createTextOutput(JSON.stringify({ error: "Unknown action" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSessions() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName("Oturumlar");

  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({ sessions: [] }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var data = sheet.getDataRange().getValues();
  var sessions = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[0]) continue;

    try {
      var sessionData = JSON.parse(row[6] || "{}");
      sessions.push({
        id: row[0],
        lessonName: row[1],
        date: row[2],
        startTime: row[3],
        endTime: row[4],
        createdAt: row[5],
        active: row[7] === true || row[7] === "true",
        attendance: sessionData.attendance || []
      });
    } catch(e) {
      sessions.push({
        id: row[0],
        lessonName: row[1],
        date: row[2],
        startTime: row[3],
        endTime: row[4],
        createdAt: row[5],
        active: row[7] === true || row[7] === "true",
        attendance: []
      });
    }
  }

  return ContentService.createTextOutput(JSON.stringify({ sessions: sessions }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var data = JSON.parse(e.postData.contents);

  if (data.type === "session") {
    return saveSessionData(data.session);
  }

  // Varsayilan: yoklama verisi (eski davranis)
  if (data.type === "attendance_update") {
    return updateSingleAttendance(data);
  }

  return saveAttendanceData(data);
}

function saveSessionData(session) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName("Oturumlar");

  if (!sheet) {
    sheet = ss.insertSheet("Oturumlar");
    sheet.appendRow(["ID", "Ders Adi", "Tarih", "Baslangic", "Bitis", "Olusturulma", "Veri", "Aktif"]);
    sheet.getRange(1, 1, 1, 8).setFontWeight("bold");
  }

  // Mevcut oturumu bul
  var data = sheet.getDataRange().getValues();
  var rowIndex = -1;
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === session.id) {
      rowIndex = i + 1;
      break;
    }
  }

  var attendanceJson = JSON.stringify({ attendance: session.attendance });

  if (rowIndex > 0) {
    // Guncelle
    sheet.getRange(rowIndex, 1, 1, 8).setValues([[
      session.id,
      session.lessonName,
      session.date,
      session.startTime,
      session.endTime,
      session.createdAt,
      attendanceJson,
      session.active
    ]]);
  } else {
    // Yeni ekle
    sheet.appendRow([
      session.id,
      session.lessonName,
      session.date,
      session.startTime,
      session.endTime,
      session.createdAt,
      attendanceJson,
      session.active
    ]);
  }

  return ContentService.createTextOutput(JSON.stringify({ success: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

var ALL_ASSISTANTS = [
  "Bülbül Aliyeva","Afra Nur Arslan","Cengizhan Yener","Hasancan Başkurt",
  "Çağdaş İsahan Erün","Cüneyt Yüksel","Halise Yener","Sueda Zeynep Kelebek",
  "Ceren Muşmuloğlu","Şefika Rumeysa İspirden","Jehan Shukraan Khudhur",
  "Atakan Kaltakkıran","Mehtap Halıcı","Ebrar Özhan","Aysu Eseler",
  "Demir Gümüşdağ","Mustafa Güney","Alphan Derici","Fatma Betül Can",
  "Fuad Mammadlı","Merve Özçiftci","Özge Varol","Artun Vardar",
  "Yöre Ülgüdür Çetin","Sena Bilgiç","Şenay Taşkın","Gökhan Çınar",
  "İlkay Emre Çodur","İrem Elgörmüş Zafer","Cansu Kalelioğlu",
  "Ekin Özmen","İclal Karacan Öztürk","Arzu Gür","Yasin Gürleyen",
  "Betül Gizem Cevahir","Berkan Sami Öztürk","Nisa Söğüt",
  "Hümeyra Türkyılmaz","Sema Nur Aslan","Kübranur Yerlikaya",
  "Nida Erdem","Merve Eroğlu","Feride Aydınoğlu","Sümeyye Gerçekçioğlu",
  "Semih Gezmişoğlu","Hatice İhlas Ekinci","Nazlı Nehir","Rabia Nur Berta"
];

function saveAttendanceData(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName("Yoklama");

  var headerText = data.date + "\n" + data.lessonName + "\n" + data.startTime + "-" + data.endTime;

  if (!sheet) {
    sheet = ss.insertSheet("Yoklama");
    sheet.getRange(1, 1).setValue("Ad Soyad").setFontWeight("bold");
    var nameValues = ALL_ASSISTANTS.map(function(n) { return [n]; });
    sheet.getRange(2, 1, nameValues.length, 1).setValues(nameValues);
  }

  var lastRow = sheet.getLastRow();
  var names = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 1).getValues() : [];

  for (var k = 0; k < ALL_ASSISTANTS.length; k++) {
    var found = false;
    for (var r = 0; r < names.length; r++) {
      if (names[r][0] === ALL_ASSISTANTS[k]) { found = true; break; }
    }
    if (!found) {
      lastRow++;
      sheet.getRange(lastRow, 1).setValue(ALL_ASSISTANTS[k]);
      names.push([ALL_ASSISTANTS[k]]);
    }
  }

  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var colIndex = -1;

  if (lastCol > 1) {
    var headers = sheet.getRange(1, 2, 1, lastCol - 1).getValues()[0];
    for (var j = 0; j < headers.length; j++) {
      if (headers[j] === headerText) {
        colIndex = j + 2;
        break;
      }
    }
  }

  if (colIndex === -1) {
    colIndex = lastCol + 1;
    sheet.getRange(1, colIndex).setValue(headerText).setFontWeight("bold").setWrap(true);
  }

  var nameMap = {};
  for (var r = 0; r < names.length; r++) {
    nameMap[names[r][0]] = r + 2;
  }

  for (var i = 0; i < data.attendance.length; i++) {
    var a = data.attendance[i];
    var rowIdx = nameMap[a.name];
    if (!rowIdx) continue;

    var statusText = a.status;
    if (a.status === "MUAF" && a.workLocation) {
      statusText = "MUAF (" + a.workLocation + ")";
    }
    sheet.getRange(rowIdx, colIndex).setValue(statusText);
  }

  return ContentService.createTextOutput(JSON.stringify({ success: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function updateSingleAttendance(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName("Oturumlar");

  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({ error: "No sessions" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var allData = sheet.getDataRange().getValues();
  for (var i = 1; i < allData.length; i++) {
    if (allData[i][0] === data.sessionId) {
      var sessionJson = {};
      try {
        sessionJson = JSON.parse(allData[i][6] || "{}");
      } catch(e) {
        sessionJson = {};
      }
      var attendance = sessionJson.attendance || [];

      var found = false;
      for (var j = 0; j < attendance.length; j++) {
        if (attendance[j].assistantId === data.assistantId) {
          attendance[j].status = data.status;
          attendance[j].workLocation = data.workLocation || "";
          attendance[j].timestamp = data.timestamp || "";
          found = true;
          break;
        }
      }

      if (!found) {
        attendance.push({
          assistantId: data.assistantId,
          status: data.status,
          workLocation: data.workLocation || "",
          timestamp: data.timestamp || ""
        });
      }

      sessionJson.attendance = attendance;
      sheet.getRange(i + 1, 7).setValue(JSON.stringify(sessionJson));
      break;
    }
  }

  return ContentService.createTextOutput(JSON.stringify({ success: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
