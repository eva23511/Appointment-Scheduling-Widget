const urlParams = new URLSearchParams(window.location.search);
const SpurwingPID = urlParams.get('pid'); // 'your spurwing provider-id';
const SpurwingHookURL = null; // Optional URL to make a callback to when a user has submitted the booking.

var SpurwingAPTID = null;  // 'your spurwing appointment type id';

let sp = new Spurwing();
const show_months = 3; // how many months to show (everything else disabled)

// get the time zone
let timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
console.log(timezone)

// initiate calendar
$(document).ready(() => {
    init_infobox();
});

// setting default static value
let BTN_LOCK = false;   // button disable or not for confirm-button (function of booking the appointment)
currentTime = null;     // record the current selected time slots

function getRange(startDate, endDate, type) {
    let fromDate = moment(startDate)
    let toDate = moment(endDate)
    let diff = toDate.diff(fromDate, type)
    let range = []
    for (let i = 0; i < diff; i++) {
    range.push(moment(startDate).add(i, type).format('YYYY-MM-DD'))
    }
    return range
}

async function init_infobox() {
    const appointment_types = [];

    let A = await sp.get_appointment_types(SpurwingPID, 1000, 0);
    console.log({A});

    let types = []
    console.log(A.length);
    console.log(A[0]);
    console.log(A[0][0]);
    $('.appointment-types-box').empty().show();

    if (!A || (A.length === 1 && A[0][0] === "data")) {
        console.log("el len is 0");
        $('.appointment-types-box').append(`<select class="form-select appointment-types" aria-label="Select appointment type" id="appointment-types" disabled="disabled">
                                            <option value="" disabled selected>No available appointment types</option>
                                            </select>`);
    } else {
        for (const el of A) {
            console.log("el len > 0");
            console.log(el);
            console.log(el.id);
            console.log(el.name);
            types.push(`<option value="${el.id}">${el.name}</option>`);
        }
        $('.appointment-types-box').append(`<select class="form-select appointment-types" aria-label="Select appointment type" id="appointment-types">
                                            <option value="" disabled selected>Choose one</option>    
                                            ${types.join('')}
                                            </select>`);
    }
    console.log(types);
}

$(document).on('change','select#appointment-types', async function(e) {
    $('.calendar-box').addClass('collapsed');
    $('.calendar-range').addClass('collapsed');
    $('.appointment-types').removeClass('long-width');
    $('.error-msg').empty();
    $('.status-msg').show();
    var appointment_type = $("option:selected", this);
    SpurwingAPTID = this.value;
    console.log("SpurwingAPTID=" + SpurwingAPTID);
    init_calendar();
});

// initiate the calendar
async function init_calendar() {
    const days_available = [];
    let minDate = moment();
    let maxDate = moment().add(show_months-1, 'M');
    disabledDates = []
    while (minDate < maxDate) {
        let B = await sp.get_days_available(SpurwingPID, SpurwingAPTID, minDate);
        console.log({B});    
        days_available.push(...B.days_available)
        minDate = minDate.startOf('month').add(1, 'M')
    }

    $('.status-msg').hide();
    if (!days_available || days_available.length === 0) {
        $('#error-msg').text(`No appointment time available for this appointment type in the last ${show_months} months`);
        return;
    }

    let range = getRange(days_available[0], days_available.slice(-1)[0], 'days')
    for (const el of range) {
        if (!days_available.includes(el))
            disabledDates.push(el);
    }

    let cal = $('.disabled-range-calendar').pignoseCalendar({
        select: onSelectHandler,
        minDate: days_available[0],
        maxDate: days_available.slice(-1)[0],
        disabledDates: disabledDates
    });

    $('.calendar-range').removeClass('collapsed');
    // location.href = "#calendar-range";
    // $('html, body').scrollTo('#calendar-range');
    $('html, body').animate({
        scrollTop: $("#calendar-range").offset().top
    }, 20);

    // default setting: selecting today's date
    onSelectHandler([cal.settings.date]);
}

function fixDateOffset(s) {
    return s.replace(' -', '-').replace(' +', '+');
}

// Handler for selecting date on the calendar
async function onSelectHandler(date) {
    // clear the old available time slots
    $('.calendar-box').addClass('collapsed');
    $('.time-slots-box').empty().show();

    let selectedDate = null;
    console.log("date:"+ date[0]);

    if (date[0] !== null) { // when date is selected
        selectedDate = date[0].format('YYYY-MM-DD');
        $('#selected-day').text(date[0].format('dddd, MMM DD'));
    } else { // when date is not selected (sometimes clicking on whitespace unselects, useless feature.)
        
        // collapse the available time slots panel
        $('.calendar-box').addClass('collapsed');
        $('.appointment-types').removeClass('long-width');
        // [mobile layout] show short message about available time slots situation
        $('#selected-day').text('The date has not yet been selected.');

        // clear the selected currentTime record
        currentTime = null;
        return;
    }

    // call spurwing javascript api to get available time slots
    let C = await sp.get_slots_available(SpurwingPID, SpurwingAPTID, selectedDate, selectedDate)
    console.log({C})

    let slots = []

    if (C.slots_available.length == 0) {
        // collapse the available time slots panel
        $('.calendar-box').addClass('collapsed');
        $('.appointment-types').removeClass('long-width');
        // [mobile layout] show short message about  available time slots situation
        $('#selected-day').text('There is no time slot available today.');
        return; // sometimes clicking on whitespace unselects, useless feature.
    }

    // show the available time slots panel
    $('.calendar-box').removeClass('collapsed');
    $('.appointment-types').addClass('long-width');
    
    // initiate time slots buttons and confirm buttons
    for (const el of C.slots_available) {
        const slot = moment(fixDateOffset(el.date)).format('hh:mm A');
        slots.push(`<div class="button-box">
                        <button type="button" class="time-slots-item" value="${el.date}">${slot}</button>
                        <button type="button" class="confirm-button collapsed">Confirm</button>
                    </div>`);
    }
    $('.time-slots-box').append(`<div class="available-time-slots">${slots.join('')}</div>`);
    // location.href = "#calendar-box";
    // $('body').scrollTo('#calendar-box');
    $('html, body').animate({
        scrollTop: $("#calendar-box").offset().top
    }, 20);
}

// when selecting the time slot of the date
$(document).on('click', 'button.time-slots-item', function() {
    // show the confirm button
    if (currentTime != null || $(currentTime).val() !== $(this).val()) {
        // collapse the last selected time slot
        $(currentTime).next().addClass("collapsed");
        $(currentTime).removeClass("un-collapsed");
    } 
    // show the current selected time slot
    $(this).next().removeClass("collapsed");
    $(this).addClass("un-collapsed");

    // update current selected time slot
    currentTime = this;

    // remove red error input on click
    $("input").click(function(){
        $(this).removeClass("error-input");
    })
})

// when booking the appointment
$(document).on('click', 'button.confirm-button', async function(e) {
    e.preventDefault();
    $('.error-msg').empty();

    if (BTN_LOCK) {
        return;
    }

    // get booking information
    const selectedSlot = $(currentTime).val();
    const name = $('#name').val().trim();
    const email = $('#email').val().trim();

    if (!name || name.length <= 1) {
        $("#name").addClass("error-input");
        $('html, body').animate({
            scrollTop: $("#info-box").offset().top
        }, 20);
        return;
    }
    if (!email || email.length <= 1) {
        $("#email").addClass("error-input");
        $('html, body').animate({
            scrollTop: $("#info-box").offset().top
        }, 20);
        return;
    }

    console.log("email:"+email);
    console.log("name:"+name);
    console.log("selectedSlot:"+selectedSlot);

    // call spurwing javascript api to book the appointment
    try {
        let D = await sp.complete_booking(SpurwingPID, SpurwingAPTID, email, name, '-', selectedSlot, 'Online Booking');
        console.log({D})
        if (D && 'appointment' in D && D.appointment.id) {
            if (SpurwingHookURL) {
                $.getJSON(SpurwingHookURL, {
                    name,
                    email,
                    start: fixDateOffset(selectedSlot),
                    end: fixDateOffset(D.appointment.end),
                }, function(resp) {
                    console.log(SpurwingHookURL, resp)
                })
            }

            // appointment book success!
            document.getElementById("name").readOnly = true;
            document.getElementById("email").readOnly = true;
            $('.appointment-types').prop("disabled", true);
            $('#name').readOnly = true;
            $('#email').readOnly = true;

            // show the appointment time
            $('.result-time').show();
            $("#appointment-time").val(moment(fixDateOffset(selectedSlot)).format('YYYY-MM-DD') + '  ' + moment(fixDateOffset(selectedSlot)).format('hh:mm A') + ' to ' + moment(fixDateOffset(D.appointment.end)).format('hh:mm A'));                
            $('.error-msg').empty();
            $('.result-msg').html('Appointment booked!<br>Thank you.');
            $('button.refresh-button').show();
            // location.href = "#info";
            // $('body').scrollTo('#info');
            $('html, body').animate({
                scrollTop: $("#info-box").offset().top
            }, 20);
            BTN_LOCK = true;
            $('.calendar-box').addClass('collapsed');
            $('.calendar-range').addClass('collapsed');
            $('.appointment-types').removeClass('long-width');
        }    
    } catch(err) {
        $('#error-msg').text(JSON.parse(err.responseText).message);
        // location.href = "#error-msg";
        // $('body').scrollTo('#error-msg');
        $('html, body').animate({
            scrollTop: $("#info-box").offset().top
        }, 20);
    }
});

// to reschedule another appointment, unset previous info and settings
$(document).on('click', 'button.refresh-button', function() {
    $("#name").val('');
    $("#email").val('');
    document.getElementById("name").readOnly = false;
    document.getElementById("email").readOnly = false;
    $('.appointment-types').prop("disabled", false);
    $('.result-msg').text('');
    $('button.refresh-button').hide();
    $('.result-time').hide();
    init_infobox();
    BTN_LOCK = false;
})