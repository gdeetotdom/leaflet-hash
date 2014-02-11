(function (window) {
	var HAS_HASHCHANGE = (function() {
		var doc_mode = window.documentMode;
		return ('onhashchange' in window) &&
			(doc_mode === undefined || doc_mode > 7);
	})();

	L.Hash = function(map) {
		this.onHashChange = L.Util.bind(this.onHashChange, this);

		if (map) {
			this.init(map);
		}
	};

    L.Hash.plugins = [];

	L.Hash.parseHash = function(hash) {
        var options = {};
        if (!hash) {
            hash = window.location.hash;
        }
		if(hash.indexOf('#') === 0) {
			hash = hash.substr(1);
		}

        if (!hash.length) {
            return false;
        }

        var arg;
        var args = {};
        hash = hash.split("&");

        for (var i = 0, l = hash.length; i < l; i++) {
            arg = hash[i].split("=");
            args[decodeURIComponent(arg[0])] = decodeURIComponent(arg[1]);
        }

        var zoom = parseInt(args.z, 10);
        if (!isNaN(zoom)) {
            options.zoom = zoom;
        }

        var lat = parseFloat(args.lat);
        var lng = parseFloat(args.lng);
        if (!isNaN(lat) && !isNaN(lng)) {
            options.center = new L.LatLng(lat, lng);
        }

        var plugins = L.Hash.plugins;
        var param;
        l = plugins.length;
        for (i = 0; i < l; i++) {
            if (plugins[i].hasOwnProperty("parse")) {
                param = plugins[i].parse(args, this.map);
                if (param === false) {
                    return false;
                }
                L.Util.extend(options, param);
            }
        }

        return options;
    };

	L.Hash.formatHash = function(map) {
        var path = [];
        if (!map && this.map) {
            map = this.map;
        }
        if (map) {
		var center = map.getCenter(),
		    zoom = map.getZoom(),
		    precision = Math.max(0, Math.ceil(Math.log(zoom) / Math.LN2));
            path.push(
                "lat=" + center.lat.toFixed(precision),
                "lng=" + center.lng.toFixed(precision),
                "z=" + zoom
            );
        }

        var plugins = L.Hash.plugins;
        var segment;
        for (var i = 0, l = plugins.length; i < l; i++) {
            if (plugins[i].hasOwnProperty("format")) {
                segment = plugins[i].format(map);
                if (segment) {
                    path.push(segment);
                }
            }
        }

        return "#" + path.join("&");
    };

    L.Hash.handleHash = function (options) {
        if (!options) {
            options = L.Hash.parseHash();
        }
        if (options.center && options.zoom && this.map) {
            this.movingMap++;
            this.map.setView(options.center, options.zoom);
            this.movingMap--;
        }

        var plugins = L.Hash.plugins;
        for (var i = 0, l = plugins.length; i < l; i++) {
            if (plugins[i].hasOwnProperty("handle")) {
                plugins[i].handle(options, this.map);
            }
        }
    };

	L.Hash.prototype = {
		map: null,
		lastHash: null,

		parseHash: L.Hash.parseHash,
		formatHash: L.Hash.formatHash,
        handleHash: L.Hash.handleHash,

		init: function(map) {
			this.map = map;

			// reset the hash
			this.lastHash = null;
			this.onHashChange();
            this._options = {};

			if (!this.isListening) {
				this.startListening();
			}
		},

		removeFrom: function(map) {
			if (this.changeTimeout) {
				clearTimeout(this.changeTimeout);
			}

			if (this.isListening) {
				this.stopListening();
			}

			this.map = null;
		},

        set: function () {
            if (this.map._loaded && !this.movingMap) {
                var hash = this.formatHash(this.map);
                if (hash !== this.lastHash) {
                    location.replace(hash);
                    this.lastHash = hash;
                }
                this.handleHash();
            }
        },

		movingMap: false,
		update: function() {
			var hash = location.hash;
			if (hash === this.lastHash) {
                var options = this.parseHash(hash);
                if (options) {
                    L.Util.extend(this._options, options);
                    this.handleHash(this._options);
                } else {
                    this.set();
                }
            }
        },

		// defer hash change updates every 100ms
		changeDefer: 100,
		changeTimeout: null,
		onHashChange: function() {
			// throttle calls to update() so that they only happen every
			// `changeDefer` ms
			if (!this.changeTimeout) {
				var that = this;
				this.changeTimeout = setTimeout(function() {
					that.update();
					that.changeTimeout = null;
				}, this.changeDefer);
			}
		},

		isListening: false,
		hashChangeInterval: null,
		startListening: function() {
            this.map.on("moveend", this.set, this);

			if (HAS_HASHCHANGE) {
				L.DomEvent.addListener(window, "hashchange", this.onHashChange);
			} else {
				clearInterval(this.hashChangeInterval);
				this.hashChangeInterval = setInterval(this.onHashChange, 50);
			}
			this.isListening = true;
		},

		stopListening: function() {
            this.map.off("moveend", this.set, this);

			if (HAS_HASHCHANGE) {
				L.DomEvent.removeListener(window, "hashchange", this.onHashChange);
			} else {
				clearInterval(this.hashChangeInterval);
			}
			this.isListening = false;
		}
	};
	L.hash = function(map) {
		return new L.Hash(map);
	};
	L.Map.prototype.addHash = function() {
		this._hash = L.hash(this);
	};
	L.Map.prototype.removeHash = function() {
		this._hash.removeFrom(this);
	};
})(window);
