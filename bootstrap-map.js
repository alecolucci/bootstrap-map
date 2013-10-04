( function ($) { "use strict";

  // MAP PUBLIC CLASS DEFINITION
  // ===============================
  var Map = function (element, options) {
    this.type       =
    this.options    =
    this.$element   = null

    this.setup('map', element, options)
  }

  // MapMarker PUBLIC CLASS DEFINITION
  // ===============================
  var MapMarker = (function(){
    function MapMarker (obj) {
      this.$element    = null
      this.id          = null
      this.latitude    = null
      this.longitude   = null
      this.name        = null
      this.description = null
      this.link        = null
      this.image       = null
      this.icon        = null
      for ( var prop in obj ) {
        if ( obj.hasOwnProperty( prop ) ) {
          this[prop] = obj[prop];
        }
      }
    }
    MapMarker.prototype.populate = function( info_window ) {
      var $content = $( info_window.content )
      $content.find( 'h4 a' ).text( this.name )
      $content.find( 'img' ).attr( 'src', this.image )
      $content.find( 'p' ).text( this.description )
      $content.find( 'a' ).attr( 'href', this.link )
      info_window.setContent($content.html())
    }
    return MapMarker
  })()

  Map.DEFAULTS = {
    template:     '<div><div class="info-window"><img/><h4><a></a></h4><p></p><hr></div></div>'
    , map:            '.map'
    , marker:         '.marker'
    , id:             ''
    , latitude:       '[itemprop=latitude]'
    , longitude:      '[itemprop=longitude]'
    , description:    '[itemprop=description]'
    , name:           '[itemprop=name]'
    , link:           '[itemprop=url] a'
    , image:          '[itemprop=image]'
    , geo:            '[itemprop=geo]'
    , center:         null    // 'geolocation' or '{lat},{lng}'
    , height:         null
    , ajax:           false
    , url:            ''
    , dataType:       'html'
    , bounds:         true
    , loadMore:       false   // Do you want an AJAX request to be made when the map is zoomed or the center is changed?
    , type:           'post'  // request type
    , data:           []      // data to be passed to ajax request
    , zoom:           5
  }

  Map.prototype.setup = function (type, element, options) {
    this.enabled      = true
    this.type         = type
    this.$element     = $(element)
    this.options      = this.getOptions(options)
    this.markers      = {}
    this.zoom         = null
    this.zoomHighest  = null
    this.center       = null

    /*** @type ui.gmap */
    this.map = this.$element.gmap({
      center: this.getLatLng(this.options.center)
      , zoom: this.options.zoom
    }).bind( 'init', $.proxy( this.init, this ) )

    /*** @type google.maps.Map */
    this.google_map   = this.$element.gmap('get','map')
  }

  Map.prototype.getDefaults = function () {
    return Map.DEFAULTS
  }

  Map.prototype.getOptions = function (options) {
    options = $.extend({}, this.getDefaults(), this.$element.data(), options)

    return options
  }

  Map.prototype.init = function() {
    if ( this.options.ajax ) {
      if ( 'geolocation' == this.options.center ) {
        this.getCurrentPosition(function(latLng){
          if ( latLng )
            this.setCenter(latLng)
          this.ajax({
            data: {
              latitude: latLng.lat()
              , longitude: latLng.lng()
              , range: this.getDistanceFromCenterToCorner()
            }
          })
        })
      } else {
        this.ajax({})
      }
    } else {
      if ( 'geolocation' == this.options.center ) {
        this.$element.one( 'markers_added', $.proxy(function(){
          this.center = this.getCurrentPosition(this.setCenter)
        }, this ))
      }
      this.addMarkers( $( this.options.marker ) )
    }

    if ( this.options.loadMore ) {
      google.maps.event.addListener( this.google_map, 'idle', $.proxy( this.loadMore, this, this.google_map ) )
    }
  }

  /**
   * Execute ajax call
   *
   * @param settings
   */
  Map.prototype.ajax = function(settings) {
    if ( typeof settings == 'undefiend' ) {
      settings = {}
    }
    settings = $.extend(true, {
      url:         this.options.url
      , type:      this.options.type
      , data:      this.options.data
      , dataType:  this.options.dataType
      , success:  $.proxy( this.addMarkers, this )
    }, settings)
    this.$element.trigger( 'ajax_settings', [ settings, this ] )
    $.ajax(settings)
  }

  Map.prototype.loadMore = function( map ){

    if ( typeof map == 'undefined' )
      map = this.google_map

    // skip if just loadded for the first time on 0,0
    if ( map.getCenter().equals(this.getLatLng({latitude:0, longitude:0})) ) {
      return
    }

    if ( !this.zoom || !this.zoomHighest || !this.center || !this.range ) {
      this.center       = map.getCenter()
      this.zoom         = map.getZoom()
      this.zoomHighest  = this.zoom
      this.range        = this.getDistanceFromCenterToCorner()
    }

    var request = {
      data: {
          latitude:   map.getCenter().lat()
        , longitude:  map.getCenter().lng()
        , range:      this.getDistanceFromCenterToCorner()
        , exclude:    Object.keys( this.markers )
      }
    }

    if ( this.zoom < map.getZoom() ) {
      // Zoomed in - don't do anything
    } else if ( this.zoom > map.getZoom() ) {
      // Zoomed out
      if ( this.zoomHighest > map.getZoom() ) {
        request.data.beyond = this.range
        this.ajax(request)
        this.zoomHighest  = map.getZoom()
        this.range        = this.getDistanceFromCenterToCorner()
      }
    } else {
      var change = google.maps.geometry.spherical.computeDistanceBetween(this.center, map.getCenter() )
      if ( change / this.range > 0.2 ) {
        this.ajax(request)
        this.zoomHighest = map.getZoom()
      }
    }
    this.zoom   = map.getZoom()
    this.center = map.getCenter()
  }

  Map.prototype.parse = function( data ) {
    var markers = {}
    if ( this.options.ajax ) {
      switch ( this.options.dataType ) {
        case 'html':
          markers = this.parseHTML( $( data ).find( this.options.marker ) )
          break;
        case 'json':
          markers = this.parseJSON( data )
          break;
      }
    } else {
      markers = this.parseHTML( data )
    }
    this.$element.trigger( 'parse', [ data, markers, this ] )
    return markers
  }

  Map.prototype.parseHTML = function( data ) {
    var that   = this
    var result = []
    $.each(data, function(){
      var $this = $(this)
      var marker = new MapMarker({
          $element:       $this
        , id:             $this.attr('id')
        , latitude:       $this.find(that.options.latitude).attr( 'content' )
        , longitude:      $this.find(that.options.longitude).attr( 'content' )
        , name:           $this.find(that.options.name).text()
        , description:    $this.find(that.options.description).text()
        , link:           $this.find(that.options.link).attr('href')
        , image:          $this.find(that.options.image).attr('src')
        , icon:           $this.find(that.options.geo ).attr('data-icon')
      })
      result.push(marker)
    })
    return $.extend({}, result)
  }

  Map.prototype.parseJSON = function( data ) {
    var that = this;
    var result = [];
    $.each( data, function(){
      var marker = new MapMarker(this)
      result.push(marker)
    })
    return $.extend({}, result)
  }

  Map.prototype.addMarkers = function( markers ) {
    if ( typeof markers !== 'undefined' ) {
      markers = this.parse( markers )
    }
    $.each( markers, $.proxy( function(i, marker) {
      if ( marker.hasOwnProperty('id') && !this.markers.hasOwnProperty( marker.id ) ) {
        this.markers[ marker.id ] = this.addMarker( marker )
      } else {
        this.markers[Object.keys(this.markers ).length + 1 ] = this.addMarker( marker )
      }
    }, this ) )
    this.$element.trigger( 'markers_added', [ this ] )
  }

  Map.prototype.addMarker = function( marker ) {
    var that = this;
    return this.map.gmap( 'addMarker', {
      position    : this.getLatLng({
          latitude: marker.latitude
        , longitude: marker.longitude
      })
      , bounds    : that.options.bounds
      , icon      : marker.icon
    } ).click(function(){
        that.map.gmap('openInfoWindow', {
          content: that.options.template
        }, this, $.proxy( marker.populate, marker ) )
      })
  }

  Map.prototype.getCurrentPosition = function(callback, geoPositionOptions) {
    if ( typeof callback == 'undefined' ) {
      callback = null
    }
    var that     = this;
    var position = null;
    if ( navigator.geolocation ) {
      navigator.geolocation.getCurrentPosition (
        function(result) {
          position = that.getLatLng( result )
          if ( callback )
            ($.proxy( callback, that, position, 'OK' ))()
        },
        function(error) {
          if ( callback )
            ($.proxy( callback, that, null, error ))()
        },
        geoPositionOptions
      );
    } else {
      if ( callback )
        ($.proxy( callback, that, null, 'NOT_SUPPORTED' ))()
    }
    return position
  }

  Map.prototype.getLatLng = function( obj ) {
    if ( obj instanceof google.maps.LatLng ) {
      return obj
    }
    if ( obj ) {
      switch ( typeof obj ) {
        case 'object':
          if ( obj.hasOwnProperty( 'latitude' ) && obj.hasOwnProperty( 'longitude' ) ) {
            return new google.maps.LatLng( obj.latitude, obj.longitude )
          } else if ( obj.hasOwnProperty( 'coords' ) ) {
            return new google.maps.LatLng( obj.coords.latitude, obj.coords.longitude )
          }
          break;
        case 'array':
          if ( obj.length == 2 ) {
            return new google.maps.LatLng( obj[0], obj[1] )
          }
          break;
        case 'string':
          if ( obj.indexOf( ',' ) !== -1 ) {
            var latLng = this.options.center.replace(/ /g,'').split(',');
            return new google.maps.LatLng( latLng[0], latLng[1] )
          }
          break;
      }
    }
    return new google.maps.LatLng( 0.0, 0,0 )
  }

  Map.prototype.setCenter = function( latLng ) {
    this.$element.gmap( 'option', 'center', latLng )
    this.$element.trigger( 'center_changed', [ this ] )
  }

  /**
   * Return distance from the center to top right corner of the screen
   *
   * @see http://stackoverflow.com/questions/3525670/radius-of-viewable-region-in-google-maps-v3
   * @returns {number}
   */
  Map.prototype.getDistanceFromCenterToCorner = function() {
    return google.maps.geometry.spherical.computeDistanceBetween(
      this.google_map.getCenter(),
      this.google_map.getBounds().getNorthEast()
    )
  }

  Map.prototype.convert = function( meters, unit ) {
    var distance = meters
    switch ( unit ) {
      case 'km':
        distance = meters / 1000;
        break;
      case 'mi':
      case 'miles':
        distance = meters / 1000 * 0.621371;
        break;
    }

    return distance
  }

  // MAP PLUGIN DEFINITION
  // =========================

  var old = $.fn.map

  /**
   * Initialize Map on a DOM element or return instance of the Map if it was initialized previously
   *
   * @param option
   * @returns function|Map|array
   */
  $.fn.map = function (option) {
    if ( typeof $(this).data('hc.map') == 'undefined' ) {
      return this.each(function () {
        var $this   = $(this)
        var data    = $this.data('hc.map')
        var options = typeof option == 'object' && option

        if (!data) $this.data('hc.map', (data = new Map(this, options)))
        if (typeof option == 'string') data[option]()
      })
    } else {
      var maps = []
      this.each(function(){
        maps.push($(this).data('hc.map'))
      })
      return maps
    }
  }

  $.fn.map.Constructor = Map

  // MAP NO CONFLICT
  // ===================

  $.fn.map.noConflict = function () {
    $.fn.map = old
    return this
  }

  $(window).on('ready', function () {
    $('.map').each(function () {
      var $map = $(this)
      $map.map($map.data())
    })
  })

}(window.jQuery) )