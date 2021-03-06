var columnKeys = [
    'startDate',
    'format',
    'venueName',
    'venueAddress',
    'city',
    'region',
    'country',
    'email'
];

// Date objects
var now = new Date();
var TODAY = new Date(now.getFullYear(), now.getMonth(), now.getDate());
var YESTERDAY = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
var CENTER_US = new google.maps.LatLng(37.6, -95.665);
var PPTQ_SEASON_END = new Date(2015, 4, 24);

/* Get date string of format MM/DD/YYYY */
function formatDateString (date) {
    return (date.getMonth() + 1) + '/' + date.getDate() + '/' + date.getFullYear();
};


/** Object definitions **/
function Event (pptq, app, i) {
    var key;
    for (var k in columnKeys) {
        key = columnKeys[k];
        if (key == 'startDate') {
            this.startDate = new Date(Date.parse(pptq.startDate));
        } else {
            this[key] = pptq[key];
        }
    }
    this.app = app;
    this.location = pptq.location;
    this.index = i;
    // XXX: don't make table
    // Create table row IFF location info isn't available
    if (!this.hasLocation()) {
        this.rowElement = this.createRow(pptq);
        this.app.table.appendChild(this.rowElement);
    } else {
        this.createMarker();
    }
}

// XXX: Don't show tables
/* Create row element for event to add to table */
Event.prototype.createRow = function (pptq) {
    var row = document.createElement('tr');
    //row.setAttribute('data-pptq-event', this);
    _.each(columnKeys, function (colKey) {
        var cell = document.createElement('td');
        var node;
        cell.setAttribute('data-column', colKey);
        if (colKey == 'email') {
            node = document.createElement('a');
            node.href = 'mailto:' + pptq[colKey];
            node.textContent = 'Email';
            cell.style['text-align'] = 'center';
            cell.appendChild(node);
        } else if (colKey == 'startDate') {
            cell.textContent = moment(this.startDate).format('MM/DD/YY');
        } else {
            cell.textContent = pptq[colKey];
        }
        row.appendChild(cell);
    }.bind(this));
    return row;
};

Event.prototype.hasLocation = function () {
    return typeof(this.location) !== 'undefined';
};

/* Create map marker for event (if location available) */
Event.prototype.createMarker = function () {
    var loc;
    var latLng;
    var map = this.app.map || null;
    if (!this.hasLocation()) { return; }

    loc = this.location.geometry.location;
    latLng = new google.maps.LatLng(loc.lat, loc.lng);
    this.marker = new google.maps.Marker({
        position: latLng,
        map: map,
        title: this.venueName
    });
    this.infoWindow = new google.maps.InfoWindow({
        content: this.infoWindowContent()
    });
    google.maps.event.addListener(this.marker, 'click', function () {
        this.app.markerClicked(this)
    }.bind(this));
}

/* Set event's marker visibility according to filter state */
Event.prototype.updateMarker = function () {
    if (typeof(this.marker) === 'undefined') { return; }
    if (this.app.controller.eventVisible(this)) {
        if (!this.marker.getMap()) {
            this.marker.setMap(this.app.map);
        }
    } else {
        if (this.marker.getMap()) {
            this.marker.setMap(null);
        }
    }
}

Event.prototype.setMarker = function (map) {
    var loc;
    var latLng;
    if (!this.hasLocation()) { return; }

    // Check controller if this event is currently filtered
    if (!this.app.controller.showEvent(this)) { map = null; }

    if (typeof(this.marker) === 'undefined') {
        // Marker doesn't exist, create
        loc = this.location.geometry.location;
        latLng = new google.maps.LatLng(loc.lat, loc.lng);
        this.marker = new google.maps.Marker({
            position: latLng,
            map: map,
            title: this.venueName
        });
        this.infoWindow = new google.maps.InfoWindow({
            content: this.infoWindowContent()
        });
        google.maps.event.addListener(this.marker, 'click', function () {
            this.app.markerClicked(this)
        }.bind(this));
    } else if (map !== this.marker.getMap()) {
        // Marker exists, update map if different.
        // Convenient for map = null to hide.
        this.marker.setMap(map);
    }
};

Event.prototype.infoWindowContent = function () {
    var shell = document.createElement('div');
    var container = document.createElement('div');
    var header = document.createElement('h4');
    var address = document.createElement('h6');
    var details = document.createElement('h6');
    var emailContainer = document.createElement('p');
    var emailLink = document.createElement('a');
    if (typeof(this.location) !== 'undefined' &&
            typeof(this.location.formatted_address) !== 'undefined') {
        address.textContent = this.location.formatted_address;
        header.appendChild(this.externalMapLink());
    } else {
        header.textContent = this.venueName;
    }
    details.textContent = this.format + ' - ' + formatDateString(this.startDate);
    emailContainer.textContent = 'Email: ';
    emailLink.href = 'mailto:' + this.email;
    emailLink.textContent = this.email;
    emailContainer.appendChild(emailLink);
    container.className = 'info-window';
    container.appendChild(header);
    if (address.textContent.length > 0) {
        container.appendChild(address);
    }
    container.appendChild(details);
    container.appendChild(emailContainer);
    shell.appendChild(container);
    return shell.innerHTML;
};

Event.prototype.externalMapLink = function () {
    var link = document.createElement('a');
    link.textContent = this.venueName;
    link.target = '_blank';
    link.href = 'https://www.google.com/maps?q=' + this.queryString();
    return link;
};

Event.prototype.queryString = function () {
    var formatStr = this.location.formatted_address;
    if (typeof(this.location.name) !== 'undefined' && this.location.name.length > 0) {
        formatStr = this.location.name + ', ' + formatStr;
    }
    return encodeURIComponent(formatStr);
};

Event.prototype.pastDate = function () {
    return this.startDate <= YESTERDAY;
};


/** Control Form **/
function ControlForm (formElement, app) {
    this.app = app;
    this.element = formElement;
    this.element.onchange = this.updateFilter.bind(this);
    this.format = {};
    this.startDate = TODAY;
    this.endDate = PPTQ_SEASON_END;
    this.dateRangePicker = $('#reportrange');
    this.dateRangePicker.find('span')
        .html(moment(this.startDate).format('MM/DD/YYYY') + ' - ' +
            moment(this.endDate).format('MM/DD/YYYY'));
    var self = this;
    this.dateRangePicker.daterangepicker({
            format: 'MM/DD/YYYY',
            minDate: moment(TODAY),
            maxDate: moment(PPTQ_SEASON_END),
            startDate: moment(TODAY),
            endDate: moment(PPTQ_SEASON_END),
            opens: 'left',
            drops: 'up'
        }, function (start, end, label) {
            // callback upon date selection
            self.startDate = start._d;
            self.endDate = end._d;
            this.element.find('span').html(start.format('MM/DD/YYYY') + ' - ' +
                end.format('MM/DD/YYYY'));
            self.updateFilter();
        });
    this.updateFilter();
}

/* Audit form, update filter values */
ControlForm.prototype.updateFilter = function () {
    // Update format
    _.each(this.element.querySelectorAll('input[type=checkbox]'), function (box) {
        this.format[box.getAttribute('value')] = box.checked;
    }.bind(this));

    this.app.refreshEvents();
};

// Based on form state, determine if event's marker should be shown
ControlForm.prototype.eventVisible = function (pptqEvent) {
    // Check by format
    if (!this.format[pptqEvent.format.toLowerCase()]) { return false; }

    // Check date within range
    if (this.startDate > pptqEvent.startDate || this.endDate < pptqEvent.startDate) {
        return false;
    }

    return true;
}


/** Grinder Object - Top level application object **/
function Grinder (mapElement, controlFormElement, tableElement) {
    // XXX: don't show table
    this.table = tableElement;
    this.mapElement = mapElement;
    this.controller = new ControlForm(controlFormElement, this);
    this.jsonUrl = 'pptqmil15locations.json';
    this.showPastEvents = false;
    this.events = [];
    this.eventsCreated = false;

    this.renderMap();
    this.fetchEvents();
    navigator.geolocation.getCurrentPosition(function (position) {
        var currentLatLng = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
        this.map.setCenter(currentLatLng);
        this.map.setZoom(7);
    }.bind(this));
}

/* Perform ajax request of JSON object of each PPTQ event */
Grinder.prototype.fetchEvents = function () {
    $.ajax(this.jsonUrl, {
        data: 'text/json',
        success: this.loadEvents.bind(this)
    });
};

/* Instantiate app's Google Map, hook up search box */
Grinder.prototype.renderMap = function () {
    this.map = new google.maps.Map(this.mapElement, this.options.mapOptions);

    // add control table
    var formatControls = document.getElementById('controller');
    this.map.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(formatControls);

    // create search box
    var mapSearchInput = document.getElementById('map-search');
    this.map.controls[google.maps.ControlPosition.TOP_LEFT].push(mapSearchInput);
    this.searchBox = new google.maps.places.SearchBox(mapSearchInput);
    google.maps.event.addListener(this.searchBox, 'places_changed', this.searchPlace.bind(this));
};

/* Map's search place selected, callback. Re-center at selected place */
Grinder.prototype.searchPlace = function () {
    var places = this.searchBox.getPlaces();
    if (places.length === 0) { return; }

    // re-center at searched place
    this.map.setCenter(places[0].geometry.location);
    this.map.setZoom(7);
};

/* Parse PPTQ event JSON, create each Event object */
Grinder.prototype.loadEvents = function (data) {
    _.each(data.pptqs, function (pptq, i) {
        // Only show upcoming or current events
        var pptqEvent = new Event(pptq, this, i);
        this.events.push(pptqEvent);
        if (this.showPastEvents === false && pptqEvent.pastDate()) {
            return;
        }
        // XXX: don't make table
        //this.table.appendChild(pptqEvent.rowElement);
    }.bind(this));
    this.eventsCreated = true;
    this.refreshEvents();
};

/* Update showing of each event marker */
Grinder.prototype.refreshEvents = function () {
    // Bail if both map and events aren't ready
    if (!(this.eventsCreated && typeof(this.map) !== 'undefined')) { return; }

    _.each(this.events, function (pptqEvent) {
        pptqEvent.updateMarker();
    }.bind(this));
};

/* Callback when marker is clicked.
 * Only show one info window at a time, and hide info window when
 * marker is clicked when its info window is already showing. */
Grinder.prototype.markerClicked = function (clickedEvent) {
    var previousEvent = this.activeEvent;
    var eventActivated = false;

    if (typeof(this.activeEvent) === 'undefined') {
        this.activeEvent = clickedEvent;
        eventActivated = true;
    } else {
        if (previousEvent !== clickedEvent) {
            // Different event activated
            this.activeEvent = clickedEvent;
            eventActivated = true;
        } else {
            // Active event re-clicked. Close.
            this.activeEvent = undefined;
        }
        previousEvent.infoWindow.close();
    }

    if (eventActivated === true) {
        clickedEvent.infoWindow.open(this.map, clickedEvent.marker);
    }
};

Grinder.prototype.options = {
    mapOptions: {
        zoom: 5,
        center: CENTER_US,
        disableDefaultUI: true,
        zoomControl: true,
        zoomControlOptions: {
            style: google.maps.ZoomControlStyle.LARGE,
            position: google.maps.ControlPosition.LEFT_CENTER
        }
    }
};

(function ($) {
    var app = new Grinder(
        document.getElementById('map-container'),
        document.getElementById('controller'),
        document.getElementById('pptq-table'));
})(jQuery);
