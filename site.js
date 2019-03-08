var express = require('express');
var session = require('express-session');
var helmet = require('helmet');
var sqlite3 = require('sqlite3');
var SQLiteStore = require('connect-sqlite3')(session);
var fs = require('fs');
var errors = require("./errors.js");
var bodyParser = require('body-parser');
var TimeUnit = require('timeunit');

var config = {};

if (!fs.existsSync("./configs")){
	fs.mkdirSync("./configs");
}

if (!fs.existsSync("./logs")){
	fs.mkdirSync("./logs");
}

function log(message, noprefix, noprint) {
	var date = new Date();
	var prefix = "[" + ('0' + date.getDate()).slice(-2) + "/" + ('0' + date.getMonth()).slice(-2) + "/" + date.getFullYear() + " " + ('0' + date.getHours()).slice(-2) + ":" + ('0' + date.getMinutes()).slice(-2) + ":" + ('0' + date.getSeconds()).slice(-2) + "] ";
	var fullMessage = message;
	if (!noprefix){
		fullMessage = prefix + message;
	}
	if (!noprint){
		console.log(fullMessage);
	}
	fs.appendFile("./logs/" + ('0' + date.getDate()).slice(-2) + "-" + ('0' + date.getMonth()).slice(-2) + "-" + date.getFullYear() + ".txt", fullMessage + "\n");
}

log("\n\n\n\n", true, true);

log("Loading config file");
if (fs.existsSync('./configs/config.json')) {
	try {
		config = JSON.parse(fs.readFileSync('./configs/config.json', 'utf8'));
		log("Loaded config file");
	}catch (e) {
		log("Failed to load config")
	}
}else{
	log("No config found!")
}

log("Checking config for correct values")
var hasMissing = false;
if (!("port" in config)) {
	log("Server port key missing from config");
	hasMissing = true;
	config.port = 3000;
}
if (!("logins" in config)) {
	log("Logins list missing from config");
	hasMissing = true;
	config.logins = [{user:"admin",pass:"password", admin: 1}];
}

function saveConfig() {
	log("Saving config");
	fs.writeFileSync('./configs/config.json', JSON.stringify(config, null, "\t"));
}

if (hasMissing === true) {
	log("Closing, please correct config");
	saveConfig();
	process.exit();
}

//Utility function for checking for numbers
function isNumeric(num){
    return !isNaN(num)
}

//Utility function for making a number 2 digit
function toTwoDigit(num){
	if (num < 10) {
		num = "0" + num	
	}
	
    return num
}

//Utility function for checking getting a date string from http://stackoverflow.com/a/4929629
function getDateStr() {
	var today = new Date();
	var dd = today.getDate();
	var mm = today.getMonth()+1;
	var yyyy = today.getFullYear();

	if(dd<10) {
		dd='0'+dd
	} 

	if(mm<10) {
		mm='0'+mm
	} 

	today = dd+'/'+mm+'/'+yyyy;
	
	return today;
}

//Create a new express app
var app = express();

//Use helmet for security
app.use(helmet());

//Check if bookings db already exists
var bookingsExists = fs.existsSync("./configs/bookings.db");

//Create BookingsDB
var BookingsDB = new sqlite3.Database("./configs/bookings.db");

//Do initial setup of bookings db 
BookingsDB.serialize(function() {
	//Check to make sure the db is setup when its created
	if (!bookingsExists) {
		//Create the rooms table with fields 'id', 'name', 'capacity'
		BookingsDB.run("CREATE TABLE `tblRooms` (`id` INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, `name` TEXT NOT NULL UNIQUE, `capacity` INTEGER NOT NULL);");
		BookingsDB.run("CREATE TABLE `tblTeacher` (`id` INTEGER PRIMARY KEY AUTOINCREMENT, `title` TEXT NOT NULL, `fName` TEXT NOT NULL, `lName` TEXT NOT NULL);");
		BookingsDB.run("CREATE TABLE `tblRoomBooking` (`id` INTEGER PRIMARY KEY AUTOINCREMENT, `teacherID` INTEGER NOT NULL, `lesson` INTEGER NOT NULL, `date` INTEGER NOT NULL, `roomID` INTEGER NOT NULL, `size` INTEGER NOT NULL);");
	}
});

//Allow for post requests
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
})); 

//Tell express to use ejs
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

//Define the check auth function
function checkAuth(req, res, next) {
  if (!req.session.user) {
	errors.throw(403, req, res, "", log, "");
  } else {
    next();
  }
}

//Define the check auth function for admins
function checkAuthAdmin(req, res, next) {
	if (!req.session.user) {
		errors.throw(403, req, res, "", log, "");
	} else if (req.session.user.admin && req.session.user.admin == 1) {
		next();
	} else {
		errors.throw(403, req, res, "", log, "");
	}
}

//Setup cookies and login
app.use(session({
	secret: '55bda0972742833913e226bfdc92d398',
	name: 'loginPersist',
	resave: true,
	saveUninitialized: true,
	store: new SQLiteStore({dir: "./configs"}),
	cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } //1 Week
}));



app.get('/', function(req, res){
	if (req.session.user) {
		res.redirect("/rooms");
	}else{
		res.render('index', { user: req.session.user, page: "index" });
	}
});

app.get('/rooms', checkAuth, function(req, res){
	BookingsDB.all("SELECT id, name, capacity FROM tblRooms ORDER BY name ASC", function(err, rows) {
		if (err) {
			errors.throw(500, req, res, err.toString().replace("Error: ", ""), log);
		}else{
			res.render('rooms', { user: req.session.user, page: "rooms", rooms: rows });
		}
	});	
});

app.get('/timetable', checkAuth, function(req, res){
	res.render('timetable', { user: req.session.user, page: "timetable" });
});

app.get('/timetable/*', checkAuth, function(req, res){
	var parts = req.url.split("/");
	var room = parts[2] || 0;
	var week = parts[3] || 0; //MIN: -14288175   MAX: 14283252
	var lessons = {};
	var startOfWeek = new Date();
	
	startOfWeek.setTime(startOfWeek.getTime() - (TimeUnit.milliseconds.convert(1, TimeUnit.days)*startOfWeek.getDay()));
	startOfWeek.setHours(0);
	startOfWeek.setMinutes(0);
	startOfWeek.setSeconds(0);
	startOfWeek.setMilliseconds(0);
	startOfWeek.setTime(startOfWeek.getTime() + (TimeUnit.milliseconds.convert(7, TimeUnit.days)*week));
	
	var endOfWeek = new Date();
	endOfWeek.setTime(startOfWeek.getTime() + TimeUnit.milliseconds.convert(7, TimeUnit.days));
	
	BookingsDB.all("SELECT id, lesson, date FROM tblRoomBooking WHERE roomID=? AND date>=? AND date<=?", room, startOfWeek.getTime(), endOfWeek.getTime(), function(err, rows) {
		if (err) {
			errors.throw(500, req, res, err.toString().replace("Error: ", ""), log);
		}else{
			BookingsDB.all("SELECT name FROM tblRooms WHERE ID=? LIMIT 1", room, function(errRoom, rowsRoom) {
				if (errRoom) {
					errors.throw(500, req, res, errRoom.toString().replace("Error: ", ""), log);
				}else{
					var tmpStart = new Date();
					tmpStart.setTime(startOfWeek.getTime() + TimeUnit.milliseconds.convert(1, TimeUnit.days));
					res.render('timetable', { user: req.session.user, page: "timetable", room: room, lessons: rows, date: getDateStr(), weekStart: tmpStart.toDateString(), week: week, roomName: rowsRoom[0].name });
				}
			});
		}
	});
});

app.get('/booking', checkAuth, function(req, res){
	res.render('booking', { user: req.session.user, page: "booking" });
});

app.get('/booking/*', checkAuth, function(req, res){
	var parts = req.url.split("/");
	var booking = parts[2] || 0;
	var bookingInfo = {};
	
	BookingsDB.all("SELECT * FROM tblRoomBooking WHERE ID=? LIMIT 1", booking, function(errBook, rowsBook) {
		if (errBook) {
			errors.throw(500, req, res, errBook.toString().replace("Error: ", ""), log);
		}else if(rowsBook && rowsBook.length !== 0) {
			bookingInfo = rowsBook[0];
			BookingsDB.all("SELECT * FROM tblRooms WHERE ID=? LIMIT 1", rowsBook[0].roomID, function(errRoom, rowsRoom) {
				if (errRoom) {
					errors.throw(500, req, res, errRoom.toString().replace("Error: ", ""), log);
				}else{
					bookingInfo.room = rowsRoom[0];
					BookingsDB.all("SELECT * FROM tblTeacher WHERE ID=? LIMIT 1", rowsBook[0].teacherID, function(errTeacher, rowsTeacher) {
						if (errTeacher) {
							errors.throw(500, req, res, errTeacher.toString().replace("Error: ", ""), log);
						}else{
							bookingInfo.teacher = rowsTeacher[0];
							res.render('booking', { user: req.session.user, page: "booking", booking: booking, bookingInfo: bookingInfo });
						}
					});
				}
			});
		}else{
			errors.throw(404, req, res, "Booking not found", log);
		}
	});
});

app.get('/teachers', checkAuth, function(req, res){
	BookingsDB.all("SELECT * FROM tblTeacher ORDER BY lName ASC", function(errTeacher, rowsTeacher) {
		if (errTeacher) {
			errors.throw(500, req, res, errTeacher.toString().replace("Error: ", ""), log);
		}else{
			res.render('teachers', { user: req.session.user, page: "teachers", teachers: rowsTeacher });
		}
	});
});

app.get('/add/teacher', checkAuthAdmin, function(req, res){
	res.render('add_teacher', { user: req.session.user, page: "teachers" });
});

app.get('/remove/teacher', checkAuthAdmin, function(req, res){
	BookingsDB.all("SELECT * FROM tblTeacher ORDER BY lName ASC", function(errTeacher, rowsTeacher) {
		if (errTeacher) {
			errors.throw(500, req, res, errTeacher.toString().replace("Error: ", ""), log);
		}else{
			res.render('remove_teacher', { user: req.session.user, page: "teachers", teachers: rowsTeacher });
		}
	});
});

app.get('/edit/teacher/*', checkAuthAdmin, function(req, res){
	var parts = req.url.split("/");
	var teacherID = parts[3] || 0;
	
	BookingsDB.all("SELECT * FROM tblTeacher WHERE id=? LIMIT 1", teacherID, function(errTeacher, rowsTeacher) {
		if (errTeacher) {
			errors.throw(500, req, res, errTeacher.toString().replace("Error: ", ""), log);
		}else{
			res.render('edit_teacher', { user: req.session.user, page: "teachers", teacher: rowsTeacher[0] });
		}
	});
});

app.get('/about', checkAuth, function(req, res){
	res.render('about', { user: req.session.user, page: "about" });
});

app.get('/add/room', checkAuthAdmin, function(req, res){
	res.render('add_room', { user: req.session.user, page: "rooms" });
});

app.get('/remove/room', checkAuthAdmin, function(req, res){
	BookingsDB.all("SELECT id, name FROM tblRooms ORDER BY name ASC", function(err, rows) {
		if (err) {
			errors.throw(500, req, res, err.toString().replace("Error: ", ""), log);
		}else{
			res.render('remove_room', { user: req.session.user, page: "rooms", rooms: rows });
		}
	});
});


function addBooking(req, res, roomID) {
	BookingsDB.all("SELECT * FROM tblTeacher ORDER BY lName ASC", function(errTeacher, rowsTeacher) {
		if (errTeacher) {
			errors.throw(500, req, res, errTeacher.toString().replace("Error: ", ""), log);
		}else{
			BookingsDB.all("SELECT id, name FROM tblRooms ORDER BY name ASC", function(errRoom, rowsRoom) {
				if (errRoom) {
					errors.throw(500, req, res, errRoom.toString().replace("Error: ", ""), log);
				}else{
					var date = new Date();
					var dateArr = {d: toTwoDigit(date.getDate()), m: toTwoDigit(date.getMonth()+1), y: date.getFullYear()}
					res.render('add_booking', { user: req.session.user, page: "booking", rooms: rowsRoom, teachers: rowsTeacher, date: dateArr, roomID: roomID });
				}
			});
		}
	});
}

app.get('/add/booking', checkAuthAdmin, function(req, res){
	addBooking(req, res, -1)
});

app.get('/add/booking/*', checkAuthAdmin, function(req, res){
	var parts = req.url.split("/");
	var roomID = parts[3] || -1;
	
	addBooking(req, res, roomID)
});

app.get('/edit/booking/*', checkAuthAdmin, function(req, res){
	var parts = req.url.split("/");
	var bookingID = parts[3] || 0;
	BookingsDB.all("SELECT * FROM tblRoomBooking WHERE id=?", bookingID, function(errBook, rowsBook) {
		if (errBook) {
			errors.throw(500, req, res, errBook.toString().replace("Error: ", ""), log);
		}else if (!rowsBook[0]) {
			errors.throw(404, req, res, "Booking not found", log);
		}else{
			BookingsDB.all("SELECT * FROM tblTeacher ORDER BY lName ASC", function(errTeacher, rowsTeacher) {
				if (errTeacher) {
					errors.throw(500, req, res, errTeacher.toString().replace("Error: ", ""), log);
				}else{
					BookingsDB.all("SELECT id, name FROM tblRooms ORDER BY name ASC", function(errRoom, rowsRoom) {
						if (errRoom) {
							errors.throw(500, req, res, errRoom.toString().replace("Error: ", ""), log);
						}else{
							var date = new Date();
							var dateArr = {d: toTwoDigit(date.getDate()), m: toTwoDigit(date.getMonth()+1), y: date.getFullYear()}
							
							var bookingInfo = rowsBook[0];
							var tmpDate = new Date();
							tmpDate.setTime(bookingInfo.date);
							bookingInfo.date = {d: toTwoDigit(tmpDate.getDate()), m: toTwoDigit(tmpDate.getMonth()+1), y: tmpDate.getFullYear()}
							
							res.render('edit_booking', { user: req.session.user, page: "booking", rooms: rowsRoom, teachers: rowsTeacher, date: dateArr, bookingInfo: bookingInfo, id: bookingID });
						}
					});
				}
			});
		}
	});	
});

app.post('/ajax/login', function(req, res){
	var username = req.body.user;
	var password = req.body.pass;
	
	var checkU = config.logins.find(x => x.user === username);
	if (checkU && checkU.user == username && checkU.pass == password) {
		req.session.user = {};
		req.session.user.id = username;
		req.session.user.admin = checkU.admin;
		res.json({success:1,error:''});
	}else{
		res.json({success:0,error:'Wrong username or password'});
	}
});

app.post('/ajax/add/room', checkAuthAdmin, function(req, res){
	var name = req.body.name;
	var capacity = req.body.capacity;
	
	if (name && capacity) {
		if (name.length > 32) {
			res.json({success:0, error:'Room name can be a maximum of 32 characters'});
		}else if (!isNumeric(capacity)) {
			res.json({success:0, error:'Room capacity has to be a number'});
		}else if (capacity < 0) {
			res.json({success:0, error:'Room capacity has to be bigger than 0'});
		}else if (capacity > 100) {
			res.json({success:0, error:'Room capacity has to be smaller than 100'});
		}else{
			BookingsDB.run("INSERT INTO tblRooms VALUES (NULL, ?, ?)", name, capacity, function(err) {
				if (err) {
					if (err.code == "SQLITE_CONSTRAINT") {
						res.json({success:0, error:'A room under that name already exists'});
					}else{
						res.json({success:0, error:'An unknown error occured (' + err.code + ')'});
						log("Error: " + err.code + " occured when adding a room");
					}
				}else{
					res.json({success:1, error:''});
				}
			});
		}
	}else{
		res.json({success:0, error:'Please supply a name and capacity for the new room'});
	}
});

app.post('/ajax/remove/room', checkAuthAdmin, function(req, res){
	var room = parseInt(req.body.room);
	
	if (room) {
		BookingsDB.run("SELECT * FROM tblRooms WHERE id=?", room, function(err) {
			if (err) {
				res.json({success:0, error:'An unknown error occured (' + err.code + ')'});
				log("Error: " + err.code + " occured when removing the room " + room);
			}else{
				BookingsDB.run("DELETE FROM tblRooms WHERE id=?", room, function(err) {
					if (err) {
						res.json({success:0, error:'An unknown error occured (' + err.code + ')'});
						log("Error: " + err.code + " occured when removing the room " + room);
					}else{
						res.json({success:1, error:''});
					}
				});
			}
		});
	}else{
		res.json({success:0, error:'Please select a room to be removed (' + room + ')'});
	}
});

app.post('/ajax/add/booking', checkAuthAdmin, function(req, res){
	var teacher = parseInt(req.body.teacher);
	var size = parseInt(req.body.size);
	var room = parseInt(req.body.room);
	var date = req.body.date;
	var lesson = parseInt(req.body.lesson);
	
	if (teacher && size && room && date && lesson) {
		var dateTmp = new Date(date);
		var dateCur = new Date();
		
		if (!isNumeric(teacher)) {
			res.json({success:0, error:'Invalid teacher'});
		}else if (!isNumeric(size)) {
			res.json({success:0, error:'Class size has to be a number'});
		}else if (!isNumeric(room)) {
			res.json({success:0, error:'Invalid room'});
		}else if (!isNumeric(lesson)) {
			res.json({success:0, error:'Invalid lesson'});
		}else if (size < 0) {
			res.json({success:0, error:'Class size has to be bigger than 0'});
		}else if (size > 100) {
			res.json({success:0, error:'Class size has to be smaller than 100'});
		}else if (isNaN(dateTmp.getTime())) {
			res.json({success:0, error:'Invalid date'});
		}else if (dateTmp.getTime() < dateCur.getTime()) {
			res.json({success:0, error:'Cant book sessions that have already been'});
		}else{
			BookingsDB.all("SELECT * FROM tblRooms WHERE id=? LIMIT 1", room, function(errRoom, rowsRoom) {
				if (errRoom) {
					res.json({success:0, error:'An unknown error occured (' + errRoom.code + ')'});
					log("Error: " + errRoom.code + " occured when booking the room " + room);
				}else if (!rowsRoom) {
					res.json({success:0, error:'Invalid room'});
				}else if (rowsRoom[0].capacity < size) {
					res.json({success:0, error:'Class too big for room'});
				}else{
					BookingsDB.all("SELECT * FROM tblTeacher WHERE id=? LIMIT 1", teacher, function(errTeacher, rowsTeacher) {
						if (errTeacher) {
							res.json({success:0, error:'An unknown error occured (' + errTeacher.code + ')'});
							log("Error: " + errTeacher.code + " occured when searching for the teacher " + teacher);
						}else if (!rowsTeacher) {
							res.json({success:0, error:'Invalid teacher'});
						}else{
							BookingsDB.all("SELECT * FROM tblRoomBooking WHERE date=? AND lesson=? AND roomID=? LIMIT 1", dateTmp.getTime(), lesson, room, function(errBook, rowsBook) {
								if (errBook) {
									res.json({success:0, error:'An unknown error occured (' + errBook.code + ')'});
									log("Error: " + errBook.code + " occured when checking for existing booking date:" + dateTmp.getTime() + " lesson:" + lesson + " room:" + room);
								}else if (!rowsBook || rowsBook.length === 0) {
									BookingsDB.run("INSERT INTO tblRoomBooking VALUES (NULL, ?, ?, ?, ?, ?)", teacher, lesson, dateTmp.getTime(), room, size, function(err) {
										if (err) {
											if (err.code == "SQLITE_CONSTRAINT") {
												res.json({success:0, error:'A booking already exists there'});
											}else{
												res.json({success:0, error:'An unknown error occured (' + err.code + ')'});
												log("Error: " + err.code + " occured when creating a booking");
											}
										}else{
											res.json({success:1, error:'', roomID: room});
										}
									});
								}else{
									res.json({success:0, error:'A booking already exists there'});
								}
							});
						}
					});
				}
			});
		}
	}else{
		res.json({success:0, error:'Please check you have filled in all the information'});
	}
});

app.post('/ajax/edit/booking', checkAuthAdmin, function(req, res){
	var teacher = parseInt(req.body.teacher);
	var size = parseInt(req.body.size);
	var room = parseInt(req.body.room);
	var date = req.body.date;
	var lesson = parseInt(req.body.lesson);
	var bookingID = parseInt(req.body.id);
	
	if (teacher && size && room && date && lesson) {
		var dateTmp = new Date(date);
		var dateCur = new Date();
		dateCur.setMilliseconds(0);
		dateCur.setSeconds(0);
		dateCur.setMinutes(0);
		dateCur.setHours(0);
		
		if (!isNumeric(teacher)) {
			res.json({success:0, error:'Invalid teacher'});
		}else if (!isNumeric(size)) {
			res.json({success:0, error:'Class size has to be a number'});
		}else if (!isNumeric(room)) {
			res.json({success:0, error:'Invalid room'});
		}else if (!isNumeric(lesson)) {
			res.json({success:0, error:'Invalid lesson'});
		}else if (size < 0) {
			res.json({success:0, error:'Class size has to be bigger than 0'});
		}else if (size > 100) {
			res.json({success:0, error:'Class size has to be smaller than 100'});
		}else if (isNaN(dateTmp.getTime())) {
			res.json({success:0, error:'Invalid date'});
		}else if (dateTmp.getTime() < dateCur.getTime()) {
			res.json({success:0, error:'Cant book sessions that have already been ' + dateTmp.getTime() + ' ' + dateCur.getTime()});
		}else{
			BookingsDB.all("SELECT * FROM tblRooms WHERE id=? LIMIT 1", room, function(errRoom, rowsRoom) {
				if (errRoom) {
					res.json({success:0, error:'An unknown error occured (' + errRoom.code + ')'});
					log("Error: " + errRoom.code + " occured when booking the room " + room);
				}else if (!rowsRoom) {
					res.json({success:0, error:'Invalid room'});
				}else if (rowsRoom[0].capacity < size) {
					res.json({success:0, error:'Class too big for room'});
				}else{
					BookingsDB.all("SELECT * FROM tblTeacher WHERE id=? LIMIT 1", teacher, function(errTeacher, rowsTeacher) {
						if (errTeacher) {
							res.json({success:0, error:'An unknown error occured (' + errTeacher.code + ')'});
							log("Error: " + errTeacher.code + " occured when searching for the teacher " + teacher);
						}else if (!rowsTeacher) {
							res.json({success:0, error:'Invalid teacher'});
						}else{
							BookingsDB.all("SELECT * FROM tblRoomBooking WHERE id=? LIMIT 1", bookingID, function(errBook, rowsBook) {
								if (errBook) {
									res.json({success:0, error:'An unknown error occured (' + errBook.code + ')'});
									log("Error: " + errBook.code + " occured when checking for existing booking date:" + dateTmp.getTime() + " lesson:" + lesson + " room:" + room);
								}else if (rowsBook || rowsBook.length !== 0) {
									BookingsDB.run("UPDATE tblRoomBooking SET teacherID=?, lesson=?, date=?, roomID=?, size=? WHERE id=?", teacher, lesson, dateTmp.getTime(), room, size, bookingID, function(err) {
										if (err) {
											if (err.code == "SQLITE_CONSTRAINT") {
												res.json({success:0, error:'That booking doesnt exist'});
											}else{
												res.json({success:0, error:'An unknown error occured (' + err.code + ')'});
												log("Error: " + err.code + " occured when editing booking " + bookingID);
											}
										}else{
											res.json({success:1, error:'', bookID: bookingID});
										}
									});
								}else{
									res.json({success:0, error:'No booking exists under that id.'});
								}
							});
						}
					});
				}
			});
		}
	}else{
		res.json({success:0, error:'Please check you have filled in all the information'});
	}
});

app.post('/ajax/add/teacher', checkAuthAdmin, function(req, res){
	var title = req.body.title;
	var fName = req.body.fName;
	var lName = req.body.lName;
	
	if (title && fName && lName) {
		if (title.length > 32) {
			res.json({success:0, error:'Teacher title can be a maximum of 32 characters'});
		}else if (fName.length > 32) {
			res.json({success:0, error:'Teacher first name can be a maximum of 32 characters'});
		}else if (lName.length > 32) {
			res.json({success:0, error:'Teacher last name can be a maximum of 32 characters'});
		}else{
			BookingsDB.run("INSERT INTO tblTeacher VALUES (NULL, ?, ?, ?)", title, fName, lName, function(err) {
				if (err) {
					res.json({success:0, error:'An unknown error occured (' + err.code + ')'});
					log("Error: " + err.code + " occured when adding a teacher");
				}else{
					res.json({success:1, error:''});
				}
			});
		}
	}else{
		res.json({success:0, error:'Please supply a title, first and last name for the new teacher'});
	}
});

app.post('/ajax/remove/teacher', checkAuthAdmin, function(req, res){
	var teacher = parseInt(req.body.teacher);
	
	if (teacher) {
		BookingsDB.run("SELECT * FROM tblTeacher WHERE id=?", teacher, function(err) {
			if (err) {
				res.json({success:0, error:'An unknown error occured (' + err.code + ')'});
				log("Error: " + err.code + " occured when removing the teacher " + teacher);
			}else{
				BookingsDB.run("DELETE FROM tblTeacher WHERE id=?", teacher, function(err) {
					if (err) {
						res.json({success:0, error:'An unknown error occured (' + err.code + ')'});
						log("Error: " + err.code + " occured when removing the teacher " + teacher);
					}else{
						res.json({success:1, error:''});
					}
				});
			}
		});
	}else{
		res.json({success:0, error:'Please select a teacher to be removed (' + teacher + ')'});
	}
});

app.post('/ajax/edit/teacher', checkAuthAdmin, function(req, res){
	var teacherID = parseInt(req.body.id);
	var title = req.body.title;
	var fName = req.body.fName;
	var lName = req.body.lName;
	
	if (title && fName && lName && teacherID) {
		if (title.length > 32) {
			res.json({success:0, error:'Teacher title can be a maximum of 32 characters'});
		}else if (fName.length > 32) {
			res.json({success:0, error:'Teacher first name can be a maximum of 32 characters'});
		}else if (lName.length > 32) {
			res.json({success:0, error:'Teacher last name can be a maximum of 32 characters'});
		}else{
			BookingsDB.all("SELECT * FROM tblTeacher WHERE id=? LIMIT 1", teacherID, function(errTeacher, rowsTeacher) {
				if (errTeacher) {
					errors.throw(500, req, res, errTeacher.toString().replace("Error: ", ""), log);
				}else if (!rowsTeacher) {
					res.json({success:0, error:'Invalid teacher'});
				}else{
					BookingsDB.run("UPDATE tblTeacher SET title=?, fName=?, lName=? WHERE id=?", title, fName, lName, teacherID, function(err) {
						if (err) {
							res.json({success:0, error:'An unknown error occured (' + err.code + ')'});
							log("Error: " + err.code + " occured when editing teacher " + teacherID);
						}else{
							res.json({success:1, error:''});
						}
					});
				}
			});
		}
	}else{
		res.json({success:0, error:'Please make sure all the fields are valid'});
	}
});

app.get('/logout', function (req, res) {
	delete req.session.user;
	res.redirect('/');
});



//Allows for a static folder
app.use(express.static('static'));

//Start the server
log("Running webserver on *:" + config.port);
app.listen(config.port);

//Error handling
app.use(function (req, res) {
	errors.throw(404, req, res, "", log);
});
app.use(function (err, req, res, next) {
	var errorNo = (err.status || 500);
	errors.throw(errorNo, req, res, err.message, log);
});
