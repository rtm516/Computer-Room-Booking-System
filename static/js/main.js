function submitLogin() {
	$('#submit').prop('disabled', true);
	
	var formData = {
		'user': $('input[name=user]').val(),
		'pass': $('input[name=pass]').val()
	};
	
    $.ajax({
		url: "/ajax/login",
		type: "POST",
		data: formData,
		dataType: 'json',
        encode: true,
		success: function(result){
			if (result.success != 1) {
				alert(result.error);
			}else{
				window.location.href = "/rooms";
			}
			$('#submit').prop('disabled', false);
		},
		error: function(xhr, status, error){
			alert("Unable to contact backend server (" + xhr.status + ")");
			$('#submit').prop('disabled', false);
		}
	});
}

function submitNewRoom() {
	$('#submit').prop('disabled', true);
	
	var formData = {
		'name': $('input[name=name]').val(),
		'capacity': $('input[name=capacity]').val()
	};
	
    $.ajax({
		url: "/ajax/add/room",
		type: "POST",
		data: formData,
		dataType: 'json',
        encode: true,
		success: function(result){
			if (result.success != 1) {
				alert(result.error);
			}else{
				alert("Room added successfully");
				window.location.href = "/rooms";
			}
			$('#submit').prop('disabled', false);
		},
		error: function(xhr, status, error){
			alert("Unable to contact backend server (" + xhr.status + ")");
			$('#submit').prop('disabled', false);
		}
	});
}

function submitRemoveRoom() { 
	$('#submit').prop('disabled', true);
	
	var formData = {
		'room': $('select[name=room]').val()
	};
	
    $.ajax({
		url: "/ajax/remove/room",
		type: "POST",
		data: formData,
		dataType: 'json',
        encode: true,
		success: function(result){
			if (result.success != 1) {
				alert(result.error);
			}else{
				alert("Room removed successfully");
				window.location.href = "/rooms";
			}
			$('#submit').prop('disabled', false);
		},
		error: function(xhr, status, error){
			alert("Unable to contact backend server (" + xhr.status + ")");
			$('#submit').prop('disabled', false);
		}
	});
}

function submitNewBooking() {
	$('#submit').prop('disabled', true);
	
	var formData = {
		'teacher': $('select[name=teacher]').val(),
		'size': $('input[name=size]').val(),
		'room': $('select[name=room]').val(),
		'date': $('input[name=date]').val(),
		'lesson': $('select[name=lesson]').val()
	};
	
    $.ajax({
		url: "/ajax/add/booking",
		type: "POST",
		data: formData,
		dataType: 'json',
        encode: true,
		success: function(result){
			if (result.success != 1) {
				alert(result.error);
			}else{
				alert("Booking added successfully");
				window.location.href = "/timetable/"+result.roomID;
			}
			$('#submit').prop('disabled', false);
		},
		error: function(xhr, status, error){
			alert("Unable to contact backend server (" + xhr.status + ")");
			$('#submit').prop('disabled', false);
		}
	});
}

function submitEditBooking() {
	$('#submit').prop('disabled', true);
	
	var formData = {
		'teacher': $('select[name=teacher]').val(),
		'size': $('input[name=size]').val(),
		'room': $('select[name=room]').val(),
		'date': $('input[name=date]').val(),
		'lesson': $('select[name=lesson]').val(),
		'id': $('input[name=id]').val()
	};
	
    $.ajax({
		url: "/ajax/edit/booking",
		type: "POST",
		data: formData,
		dataType: 'json',
        encode: true,
		success: function(result){
			if (result.success != 1) {
				alert(result.error);
			}else{
				alert("Booking edited successfully");
				console.log(result);
				window.location.href = "/booking/"+result.bookID;
			}
			$('#submit').prop('disabled', false);
		},
		error: function(xhr, status, error){
			alert("Unable to contact backend server (" + xhr.status + ")");
			$('#submit').prop('disabled', false);
		}
	});
}

function submitNewTeacher() {
	$('#submit').prop('disabled', true);
	
	var formData = {
		'title': $('input[name=title]').val(),
		'fName': $('input[name=fName]').val(),
		'lName': $('input[name=lName]').val()
	};
	
    $.ajax({
		url: "/ajax/add/teacher",
		type: "POST",
		data: formData,
		dataType: 'json',
        encode: true,
		success: function(result){
			if (result.success != 1) {
				alert(result.error);
			}else{
				alert("Teacher added successfully");
				window.location.href = "/teachers";
			}
			$('#submit').prop('disabled', false);
		},
		error: function(xhr, status, error){
			alert("Unable to contact backend server (" + xhr.status + ")");
			$('#submit').prop('disabled', false);
		}
	});
}

function submitRemoveTeacher() { 
	$('#submit').prop('disabled', true);
	
	var formData = {
		'teacher': $('select[name=teacher]').val()
	};
	
    $.ajax({
		url: "/ajax/remove/teacher",
		type: "POST",
		data: formData,
		dataType: 'json',
        encode: true,
		success: function(result){
			if (result.success != 1) {
				alert(result.error);
			}else{
				alert("Teacher removed successfully");
				window.location.href = "/teachers";
			}
			$('#submit').prop('disabled', false);
		},
		error: function(xhr, status, error){
			alert("Unable to contact backend server (" + xhr.status + ")");
			$('#submit').prop('disabled', false);
		}
	});
}

function submitEditTeacher() {
	$('#submit').prop('disabled', true);
	
	var formData = {
		'id': $('input[name=id]').val(),
		'title': $('input[name=title]').val(),
		'fName': $('input[name=fName]').val(),
		'lName': $('input[name=lName]').val()
	};
	
    $.ajax({
		url: "/ajax/edit/teacher",
		type: "POST",
		data: formData,
		dataType: 'json',
        encode: true,
		success: function(result){
			if (result.success != 1) {
				alert(result.error);
			}else{
				alert("Teacher edited successfully");
				window.location.href = "/teachers";
			}
			$('#submit').prop('disabled', false);
		},
		error: function(xhr, status, error){
			alert("Unable to contact backend server (" + xhr.status + ")");
			$('#submit').prop('disabled', false);
		}
	});
}

$(function() {
	$("#loginForm").find('input').keypress(function(e) {
		console.log("test");
		if(e.which == 10 || e.which == 13) {
			submitLogin();
		}
	});

	$("#addRoomForm").submit(function(e){
		e.preventDefault(e);
		submitNewRoom();
	});

	$("#removeRoomForm").submit(function(e){
		e.preventDefault(e);
		submitRemoveRoom();
	});

	$("#addBookingForm").submit(function(e){
		e.preventDefault(e);
		submitNewBooking();
	});

	$("#editBookingForm").submit(function(e){
		e.preventDefault(e);
		submitEditBooking();
	});

	$("#addTeacherForm").submit(function(e){
		e.preventDefault(e);
		submitNewTeacher();
	});

	$("#removeTeacherForm").submit(function(e){
		e.preventDefault(e);
		submitRemoveTeacher();
	});

	$("#editTeacherForm").submit(function(e){
		e.preventDefault(e);
		submitEditTeacher();
	});
});