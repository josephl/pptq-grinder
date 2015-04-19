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
    this.rowElement = this.createRow(pptq);
}

Event.prototype.createRow = function (pptq) {
    var row = document.createElement('tr');
    row.setAttribute('data-pptq-event', this);
    _.each(columnKeys, function (colKey) {
        var cell = document.createElement('td');
        cell.setAttribute('data-column', colKey);
        cell.innerText = pptq[colKey];
        row.appendChild(cell);
    });
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
        var self = this;
        //google.maps.event.addListener(this.marker, 'click', function () {
        //    self.infoWindow.open(map, self.marker);
        //});
        google.maps.event.addListener(this.marker, 'click', function () {
            self.app.clickEvent(self)
        });
        // TODO: infowindow
    } else {
        // Marker exists, update map. Convenient for map = null to hide.
        this.marker.setMap(map);
    }
}

Event.prototype.infoWindowContent = function () {
    var container = document.createElement('div');
    var header = document.createElement('h3');
    var info = document.createElement('p');
    var emailContainer = document.createElement('p');
    var emailLink = document.createElement('a');
    header.innerText = this.venueName;
    info.innerText = this.format + ' - ' +
        (this.startDate.getMonth() + 1) + '/' +
        this.startDate.getDate() + '/' +
        (this.startDate.getFullYear());
    emailContainer.innertText = 'Email: ';
    emailLink.href = 'mailto:' + this.email;
    emailLink.innerText = this.email;
    emailContainer.appendChild(emailLink);
    container.appendChild(header);
    container.appendChild(info);
    container.appendChild(emailContainer);
    return container.innerHTML;
}

Event.prototype.pastDate = function () {
    return this.startDate <= yesterday;
}

function Grinder (mapElement, tableElement, currentLocation) {
    var mapOptions = {
        center: {
            lat: currentLocation.coords.latitude,
            lng: currentLocation.coords.longitude
        },
        zoom: 6
    };
    this.map = new google.maps.Map(mapElement, mapOptions);
    this.table = tableElement;
    this.jsonUrl = 'pptqmil15locations.json';
    this.showPastEvents = false;
    this.events = [];
}

Grinder.prototype.fetchEvents = function () {
    $.ajax(this.jsonUrl, {
        data: 'text/json',
        success: this.renderEvents.bind(this)
    });
}

Grinder.prototype.renderEvents = function (data) {
    var self = this;
    _.each(data.pptqs, function (pptq, i) {
        // Only show upcoming or current events
        var pptqEvent = new Event(pptq, self, i);
        self.events.push(pptqEvent);
        if (self.showPastEvents === false && pptqEvent.pastDate()) {
            return;
        }
        self.table.appendChild(pptqEvent.rowElement);
        pptqEvent.setMarker(self.map);
    });
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
    app.fetchEvents();
};

(function ($) {
    navigator.geolocation.getCurrentPosition(initializeApp);
})(jQuery);
