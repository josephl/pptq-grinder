function formatAddress (pptqObject) {
    return ['city', 'region', 'country'].map(function (level) {
        return pptqObject[level];
    }).filter(function (term) {
        return term !== undefined && term.length > 0;
    }).join(', ');
}

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
var yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);

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
    //this.rowElement = this.createRow(pptq);
}

/* Create row element for event to add to table */
Event.prototype.createRow = function (pptq) {
    var row = document.createElement('tr');
    row.setAttribute('data-pptq-event', this);
    _.each(columnKeys, function (colKey) {
        var cell = document.createElement('td');
        var node;
        cell.setAttribute('data-column', colKey);
        if (colKey == 'email') {
            node = document.createElement('a');
            node.href = 'mailto:' + pptq[colKey];
            node.innerText = 'Email';
            cell.style['text-align'] = 'center';
            cell.appendChild(node);
        } else if (colKey == 'startDate') {
            cell.innerText = this.dateString();
        } else {
            cell.innerText = pptq[colKey];
        }
        row.appendChild(cell);
    }.bind(this));
    return row;
}

Event.prototype.hasLocation = function () {
    return typeof(this.location) !== 'undefined';
}

Event.prototype.setMarker = function (map) {
    var loc;
    var latLng;
    if (!this.hasLocation()) { return; }
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
            this.app.clickEvent(this)
        }.bind(this));
    } else if (map !== this.marker.getMap()) {
        // Marker exists, update map if different.
        // Convenient for map = null to hide.
        this.marker.setMap(map);
    }
}

Event.prototype.infoWindowContent = function () {
    var shell = document.createElement('div');
    var container = document.createElement('div');
    var header = document.createElement('h4');
    var address = document.createElement('h6');
    var details = document.createElement('h6');
    var emailContainer = document.createElement('p');
    var emailLink = document.createElement('a');
    header.innerText = this.venueName;
    if (typeof(this.location) !== 'undefined' &&
            typeof(this.location.formatted_address) !== 'undefined') {
        address.innerText = this.location.formatted_address;
    }
    details.innerText = this.format + ' - ' + this.dateString();
    emailContainer.innerText = 'Email: ';
    emailLink.href = 'mailto:' + this.email;
    emailLink.innerText = this.email;
    emailContainer.appendChild(emailLink);
    container.className = 'info-window';
    container.appendChild(header);
    if (address.innerText.length > 0) {
        container.appendChild(address);
    }
    container.appendChild(details);
    container.appendChild(emailContainer);
    shell.appendChild(container);
    return shell.innerHTML;
}

/* Get date string of format MM/DD/YY */
Event.prototype.dateString = function () {
    return (this.startDate.getMonth() + 1) + '/' +
        this.startDate.getDate() + '/' +
        (this.startDate.getYear() % 100);
}

Event.prototype.pastDate = function () {
    return this.startDate <= yesterday;
}

function Grinder (mapElement, tableElement) {
    // XXX: don't show table
    //this.table = tableElement;
    this.mapElement = mapElement;
    this.jsonUrl = 'pptqmil15locations.json';
    this.showPastEvents = false;
    this.events = [];
    this.eventsCreated = false;
    this.fetchEvents();
    navigator.geolocation.getCurrentPosition(this.renderMap.bind(this));
}

Grinder.prototype.fetchEvents = function () {
    $.ajax(this.jsonUrl, {
        data: 'text/json',
        success: this.renderEvents.bind(this)
    });
}

Grinder.prototype.renderMap = function (currentLocation) {
    var mapOptions = {
        center: {
            lat: currentLocation.coords.latitude,
            lng: currentLocation.coords.longitude
        },
        zoom: 8
    };
    this.map = new google.maps.Map(this.mapElement, mapOptions);

    // Show all markers
    _.each(this.events, function (pptqEvent) {
        pptqEvent.setMarker(this.map);
    }.bind(this));
}

Grinder.prototype.renderEvents = function (data) {
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
    _.each(this.events, function (pptqEvent) {
        pptqEvent.setMarker(this.map);
    }.bind(this));
}

/* Callback when marker is clicked */
Grinder.prototype.clickEvent = function (clickedEvent) {
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
}

var initializeApp = function (position) {
    var table = document.getElementById('pptq-table');
    var map = document.getElementById('map-container');
    var app = new Grinder(map, table, position);
};

(function ($) {
    //navigator.geolocation.getCurrentPosition(initializeApp);
    var app = new Grinder(document.getElementById('map-container'));
})(jQuery);
