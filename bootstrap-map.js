( function ($) { "use strict";

  // MAP PUBLIC CLASS DEFINITION
  // ===============================
  var Map = function (element, options) {
    this.type       =
    this.options    =
    this.$element   = null

    this.init('map', element, options)
  }

  // MapMarker PUBLIC CLASS DEFINITION
  // ===============================
  var MapMarker = (function(){
    function MapMarker (obj) {
      this.$element    = null
      this.latitude    = ''
      this.longitude   = ''
      this.name        = ''
      this.description = ''
      this.link        = ''
      this.image       = ''
      this.icon        = ''
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
    , data:           '{}'      // data to be passed to ajax request
  }

  Map.prototype.init = function (type, element, options) {
    this.enabled    = true
    this.type       = type
    this.$element   = $(element)
    this.options    = this.getOptions(options)
    this.map        = this.$element.gmap().bind( 'init', $.proxy( this.setup, this )) /*** @type ui.gmap */
    this.google_map = this.$element.gmap('get','map')                                 /*** @type google.maps.Map */
    this.markers    = [];
    this.zoom       = null
    this.zoomHighest = null
    this.center     = null

    if ( 'geolocation' == this.options.center ) {
      this.$element.one( 'addedMarkers', $.proxy(function(){
        var that = this
        this.getCurrentPosition( function( position, status ){
          if ( 'OK' === status ) {
            that.setCenter( that.getLatLng( position ) )
          }
        } )
      }, this ))
    } else if ( typeof this.options.center == 'string' && this.options.center.indexOf( ',' ) !== -1 ) {
      this.$element.one( 'addedMarkers', $.proxy(function(){
        this.setCenter( this.getLatLng( this.options.center ) )
      }, this ))
    }
  }

  Map.prototype.getDefaults = function () {
    return Map.DEFAULTS
  }

  Map.prototype.getOptions = function (options) {
    options = $.extend({}, this.getDefaults(), this.$element.data(), options)

    return options
  }

  Map.prototype.setup = function() {
    if ( this.options.ajax ) {
      this.setupAjax()
    } else {
      this.parse( $( this.options.marker ) )
      this.addMarkers()
    }
  }

  /**
   * Execute ajax call
   *
   * @param settings
   */
  Map.prototype.ajax = function(settings) {
    if ( typeof settings == 'undefiend' ) {
      var settings = {}
    }
    var settings = $.extend(true, {
      url:            this.options.url
      , type:         this.options.type
      , data:         $.parseJSON( this.options.data )
      , dataType:     this.options.dataType
    }, settings)
    var that = this
    $.ajax(settings).done(function(data){
        that.parse(data)
        that.addMarkers()
      })
  }

  Map.prototype.setupAjax = function(){
    this.ajax({})
    if ( this.options.loadMore ) {
      var that = this
      google.maps.event.addListener( this.google_map, 'idle', function(){

        // skip if just loadded for the first time on 0,0
        if ( this.getCenter().equals(that.getLatLng({latitude:0, longitude:0})) ) {
          return
        }

        if ( !that.zoom && !that.zoomHighest && !that.center && !that.range ) {
          that.center       = this.getCenter()
          that.zoom         = this.getZoom()
          that.zoomHighest  = that.zoom
          that.range        = that.getDistanceFromCenterToCorner()
        }

        if ( that.zoom < this.getZoom() ) {
          // don't do anything
        } else if ( that.zoom > this.getZoom() ) {
          if ( that.zoomHighest > this.getZoom() ) {
            that.ajax({
              data: {
                  latitude:   this.getCenter().lat()
                , longitude:  this.getCenter().lng()
                , beyond:     that.range
                , range:      that.getDistanceFromCenterToCorner() - that.range
              }
            })
            that.zoomHighest = this.getZoom()
          }
        } else {
          var change = google.maps.geometry.spherical.computeDistanceBetween(that.center, this.getCenter() )
          if ( change / that.range > 0.1 ) {
            that.ajax({
              data: {
                latitude:     this.getCenter().lat()
                , longitude:  this.getCenter().lng()
                , range:      that.getDistanceFromCenterToCorner()
              }
            })
          }
          that.zoomHighest = this.getZoom()
        }
        that.zoom   = this.getZoom()
        that.center = this.getCenter()
        that.range  = that.getDistanceFromCenterToCorner()
      })
    }
  }

  Map.prototype.parse = function( data ) {
    var markers = []

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

    this.$element.trigger( 'parse', data, markers, this )

    this.markers = markers
  }

  Map.prototype.parseHTML = function( data ) {
    var that   = this
    var result = []
    $.each(data, function(){
      var $this = $(this)
      var marker = new MapMarker({
        $element:         $this
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
    return result
  }

  Map.prototype.parseJSON = function( data ) {
    var that = this;
    var result = [];
    $.each( data, function(){
      var marker = new MapMarker(this)
      result.push(marker)
    })
    return result
  }

  Map.prototype.addMarkers = function( markers ) {
    if ( typeof markers === 'undefined' ) {
      var markers = this.markers
    }
    var that = this
    $.each( markers, function(){
      that.addMarker( this )
    })
    this.$element.trigger( 'addedMarkers', this )
  }

  Map.prototype.addMarker = function( marker ) {
    var that = this;
    this.map.gmap( 'addMarker', {
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
    if ( navigator.geolocation ) {
      navigator.geolocation.getCurrentPosition (
        function(result) {
          callback(result, 'OK')
        },
        function(error) {
          callback(null, error)
        },
        geoPositionOptions
      );
    } else {
      callback(null, 'NOT_SUPPORTED')
    }
  }

  Map.prototype.getLatLng = function( obj ) {
    if ( obj instanceof google.maps.LatLng ) {
      return obj
    }
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
    return new google.maps.LatLng( 0.0, 0,0 )
  }

  Map.prototype.setCenter = function( latLng ) {
    this.$element.gmap( 'option', 'center', latLng )
    this.$element.trigger( 'centered', this )
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
    if ( typeof $(this).data('bs.map') == 'undefined' ) {
      return this.each(function () {
        var $this   = $(this)
        var data    = $this.data('bs.map')
        var options = typeof option == 'object' && option

        if (!data) $this.data('bs.map', (data = new Map(this, options)))
        if (typeof option == 'string') data[option]()
      })
    } else {
      var maps = []
      this.each(function(){
        maps.push($(this).data('bs.map'))
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