(function() {
  'use strict';

  function sizeContainers() {
    // top and bottom
    var $tc = $('#top-container');
    var $bc = $('#bottom-container');
    var wh = $(window).height();
    var tch = wh / 2 - $tc.offset().top - 25;
    $tc.height(tch);
    var bch = wh - $tc.height() - $tc.offset().top - 25;
    $bc.height(bch);

    // top left and top right
    var $rs = $('#right-side');
    var $ls = $('#left-side');

    var ww = $(window).width();

    // webgl view: fills bottom container, spans entire window
    $('#webgl-container').height(bch).width(ww);

    $ls.width(ww * .3);
    $rs.width(ww - $ls.width()-75);
    $rs.height(tch);
    $ls.height(tch);
    $('#results-table-container').height($ls.height() - 15);
  }
  sizeContainers();

  $(window).on('resize', sizeContainers);

  var mod = angular.module('AsterankApp', ['ui.bootstrap', 'utils'])
    .config(function($interpolateProvider) {
        $interpolateProvider.startSymbol('[[').endSymbol(']]');
    });

  mod.directive('autocomplete', function() {
    return {
      restrict: 'A',
      replace: true,
      transclude: true,
      template: '<div><input class="span3" type="text" placeholder="Lookup asteroids, eg. 433 Eros"/>'
          + '<div id="asteroid-lookup-suggestions"></div></div>',

      link: function($scope, element, attrs) {
        var $el = $(element).find('input');
        $el.autocomplete({
          minChars: 3,
          serviceUrl: '/api/autocomplete',
          paramName: 'query',
          transformResult: function(resp) {
            return $.map(resp, function(item) {
              return {value: item.full_name, data: item};
            });
          },
          onSelect: function(suggestion) {
            $scope.Lookup(suggestion);
          },
          appendTo: '#asteroid-lookup-suggestions'
        });
      }
    };
  });
})();
