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
    , center:         'autodetect'
    , position:       undefined
    , height:         '400px'
    , ajax:           false
    , url:            ''
    , dataType:       'html'
  }

  Map.prototype.init = function (type, element, options) {
    this.enabled  = true
    this.type     = type
    this.$element = $(element)
    this.options  = this.getOptions(options)
    this.map      = this.$element.gmap().bind( 'init', $.proxy( this.setup, this ))
    this.markers  = []

    if ( this.options.ajax ) {
      var that = this
      $.ajax({
        url:            this.options.url
        , dataType:     this.options.dataType
      }).done(function( data ){
          that.parse( data )
          that.addMarkers()
        } )
    } else {
      this.parse( $( this.options.marker ) )
      this.addMarkers()
    }
  }

  Map.prototype.getDefaults = function () {
    return Map.DEFAULTS
  }

  Map.prototype.getOptions = function (options) {
    options = $.extend({}, this.getDefaults(), this.$element.data(), options)

    return options
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
  }

  Map.prototype.addMarker = function( marker ) {
    var that = this;
    this.map.gmap( 'addMarker', {
      position    : new google.maps.LatLng(marker.latitude, marker.longitude)
      , bounds    : true
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

  // MAP PLUGIN DEFINITION
  // =========================

  var old = $.fn.map

  $.fn.map = function (option) {
    return this.each(function () {
      var $this   = $(this)
      var data    = $this.data('bs.map')
      var options = typeof option == 'object' && option

      if (!data) $this.data('bs.map', (data = new Map(this, options)))
      if (typeof option == 'string') data[option]()
    })
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