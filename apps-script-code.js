// Bu kodu Google Apps Script editörüne yapıştırın
// https://script.google.com/u/0/home/projects/1sQJ6wxrm_WCSWz4XGNL0gGPwvLnkeTD6ARScqlyFmpIz2YTwYs8P61pU/edit

var SPREADSHEET_ID = "10FJ11WGIItPOaLiZLTfHjkYZPHKqnZLnn-_1SrhJY2g";
var SCHEDULE_SPREADSHEET_ID = "1sOyKqpxkh_QuVlDiUi1UWnBR3ML0lVNjb94N0KcXG2g";

function doGet(e) {
  var action = e.parameter.action;

  if (action === "getSessions") {
    return getSessions();
  }

  if (action === "claimToken") {
    return claimToken(e.parameter.sessionId, e.parameter.token, e.parameter.assistantId);
  }

  if (action === "getDailySchedule") {
    return getDailyScheduleAction();
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

  var now = new Date();
  now.setHours(0, 0, 0, 0);
  var cutoffTime = now.getTime() - 4 * 24 * 60 * 60 * 1000;

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[0]) continue;

    var rowDate = null;
    if (row[2] instanceof Date) {
      rowDate = row[2];
    } else {
      var dateStr = String(row[2]);
      var parts = dateStr.split(".");
      if (parts.length === 3) {
        rowDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      }
    }
    if (rowDate && rowDate.getTime() < cutoffTime) continue;

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

  // Yoklama sayfasini da guncelle
  try {
    var attendanceForSheet = [];
    for (var a = 0; a < session.attendance.length; a++) {
      var att = session.attendance[a];
      var name = "";
      if (att.assistantId && att.assistantId > 0 && att.assistantId <= ALL_ASSISTANTS.length) {
        name = ALL_ASSISTANTS[att.assistantId - 1];
      }
      if (!name) continue;
      var statusText = att.status === "var" ? "VAR" : att.status === "muaf" ? "MUAF" : "YOK";
      if (statusText === "MUAF" && att.workLocation) {
        statusText = "MUAF (" + att.workLocation + ")";
      }
      attendanceForSheet.push({ name: name, status: statusText, workLocation: att.workLocation || "", timestamp: att.timestamp || "" });
    }
    if (attendanceForSheet.length > 0) {
      saveAttendanceData({
        date: session.date,
        lessonName: session.lessonName,
        startTime: session.startTime,
        endTime: session.endTime,
        attendance: attendanceForSheet
      });
    }
  } catch(e) {
    // Yoklama sayfasi hatasi oturum kaydini engellemesin
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

function formatTime(val) {
  if (val instanceof Date) {
    var h = val.getHours();
    var m = val.getMinutes();
    return (h < 10 ? "0" + h : h) + ":" + (m < 10 ? "0" + m : m);
  }
  return String(val);
}

function saveAttendanceData(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName("Yoklama");

  var headerText = data.lessonName + " " + formatTime(data.startTime) + "-" + formatTime(data.endTime);

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
    if (a.timestamp && a.status !== "MUAF") {
      statusText += " " + a.timestamp;
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

function getDailyScheduleAction() {
  try {
    var ss = SpreadsheetApp.openById(SCHEDULE_SPREADSHEET_ID);
    var sheets = ss.getSheets();
    var today = new Date();
    var todayDay = today.getDate();
    var todayMonth = today.getMonth();

    var MONTH_NAMES = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran",
                       "Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
    var monthName = MONTH_NAMES[todayMonth];
    var yearStr = String(today.getFullYear());
    var dateSearch = todayDay + " " + monthName;

    var sheet = null;
    for (var i = 0; i < sheets.length; i++) {
      var name = sheets[i].getName();
      if (name.indexOf(monthName) >= 0) {
        sheet = sheets[i];
        if (name.indexOf(yearStr) >= 0) break;
      }
    }
    if (!sheet) sheet = sheets[sheets.length - 1];

    var data = sheet.getDataRange().getValues();
    var todayCol = -1;
    var dateRow = -1;

    for (var r = 0; r < data.length; r++) {
      for (var c = 0; c < data[r].length; c++) {
        var cell = data[r][c];
        if (cell instanceof Date) {
          var d = new Date(cell);
          d.setHours(0, 0, 0, 0);
          var t2 = new Date(today);
          t2.setHours(0, 0, 0, 0);
          if (d.getTime() === t2.getTime()) {
            todayCol = c;
            dateRow = r;
            break;
          }
        }
        var cellStr = String(cell).trim();
        if (cellStr === dateSearch || cellStr === todayDay + " " + monthName + " " + yearStr) {
          todayCol = c;
          dateRow = r;
          break;
        }
      }
      if (todayCol >= 0) break;
    }

    if (todayCol < 0) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false, error: "today_not_found",
        date: Utilities.formatDate(new Date(), "Europe/Istanbul", "dd.MM.yyyy"),
        searchedFor: dateSearch, sheetName: sheet.getName()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var assignments = [];
    var blankCount = 0;
    for (var r2 = dateRow + 1; r2 < Math.min(data.length, dateRow + 25); r2++) {
      var cell2 = data[r2][todayCol];
      if (!cell2 || String(cell2).trim() === "") {
        blankCount++;
        if (blankCount >= 3) break;
        continue;
      }
      blankCount = 0;
      assignments.push(String(cell2).trim());
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      date: Utilities.formatDate(new Date(), "Europe/Istanbul", "dd.MM.yyyy"),
      assignments: assignments,
      sheetName: sheet.getName()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false, error: err.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function claimToken(sessionId, token, assistantId) {
  if (!sessionId || !token || !assistantId) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: "missing_params" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName("KullanilanTokenlar");
    if (!sheet) {
      sheet = ss.insertSheet("KullanilanTokenlar");
      sheet.appendRow(["Token", "SessionID", "Zaman"]);
      sheet.getRange(1, 1, 1, 3).setFontWeight("bold");
    }

    var key = sessionId + "_" + token + "_" + assistantId;
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === key) {
        lock.releaseLock();
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: "already_used" }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    sheet.appendRow([key, sessionId, new Date().toISOString()]);
    lock.releaseLock();

    var now = new Date().getTime();
    var toDelete = [];
    for (var j = data.length - 1; j >= 1; j--) {
      if (data[j][2]) {
        var tokenTime = new Date(data[j][2]).getTime();
        if (now - tokenTime > 3600000) {
          toDelete.push(j + 1);
        }
      }
    }
    for (var k = 0; k < toDelete.length; k++) {
      sheet.deleteRow(toDelete[k]);
    }

    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(e) {
    lock.releaseLock();
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: e.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
