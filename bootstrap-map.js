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
  var MapMarker = function( element, selectors ) {
    this.$element                 = null
    this.selectors                = {}
    this.selectors.latitude       =
    this.selectors.longitude      =
    this.selectors.description    =
    this.selectors.name           =
    this.selectors.link           =
    this.selectors.image          =
    this.selectors.geo            =
    this.selectors.image          =
    this.latitude                 =
    this.longitude                =
    this.name                     =
    this.description              =
    this.link                     =
    this.image                    =
    this.icon                     =

    this.init( element, selectors )
  }

  MapMarker.prototype.init = function( element, selectors ) {
    this.$element   = $(element)
    this.selectors  = selectors
    this.fill()
  }

  MapMarker.prototype.fill = function() {
    this.latitude     = this.$element.find(this.selectors.latitude).attr( 'content' )
    this.longitude    = this.$element.find(this.selectors.longitude).attr( 'content' )
    this.name         = this.$element.find(this.selectors.name).text()
    this.description  = this.$element.find(this.selectors.description).text()
    this.link         = this.$element.find(this.selectors.link).attr('href')
    this.image        = this.$element.find(this.selectors.image).attr('src')
    this.icon         = this.$element.find(this.selectors.geo ).attr('data-icon')
  }

  Map.DEFAULTS = {
    template:     '<div class="info-window"><h4 class="title"><a></a></h4><img/><p class="description"></p><hr></div>'
    , map:            '.map'
    , marker:         '.marker'
    , latitude:       '[itemprop=latitude]'
    , longitude:      '[itemprop=longitude]'
    , description:    '[itemprop=description]'
    , name:           '[itemprop=name]'
    , link:           '[itemprop=url]'
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

    if ( this.options.ajax ) {
      $.ajax({
        url:            this.options.url
        , dataType:     this.options.dataType
      }).done($.proxy( this.parseResponse, this ) )
    } else {
      this.markers = $(this.options.marker)
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
    if ( !this.options.ajax ) {
      var markers = this.parseHTMLMarkers( this.markers )
      this.addMarkers( markers )
    }
  }

  Map.prototype.parseHTMLMarkers = function( markers ) {
    var that = this;
    var result = [];
    $.each(markers, function(){
      var marker = new MapMarker($(this), {
        latitude:       that.options.latitude
        , longitude:      that.options.longitude
        , description:    that.options.description
        , name:           that.options.name
        , link:           that.options.link
        , image:          that.options.image
        , icon:           that.options.icon
      })
      result.push(marker)
    })
    return result
  }

  Map.prototype.addMarkers = function( markers ) {
    $.each( markers, $.proxy( function( index, marker ){
      this.addMarker( marker )
    }, this ) )
  }

  Map.prototype.addMarker = function( marker ) {
    this.map.gmap( 'addMarker', {
      position  : new google.maps.LatLng(marker.latitude, marker.longitude)
      , bounds    : true
      , icon      : marker.icon
    })
  }

  Map.prototype.parseResponse = function( data ) {
    this.addMarkers( markers )
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