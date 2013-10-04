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

  mod.directive('autocomplete', function($timeout) {
    return {
      restrict: 'A',
      link: function($scope, element, attrs) {
        if (!$scope.$eval(attrs.autocomplete))return;
        var field = $scope.$eval(attrs.param);
        $(element).autocomplete({
          width: '200px',
          noCache: true, //TODO delete this
          minChars: 2, //TODO think about it
          params: {
//            collection: 'asteriods', //TODO
            field: field
          },
          serviceUrl: '/api/autocomplete',
          paramName: 'query',
          transformResult: function(resp) {
            return $.map(resp, function(item) {
              return {value: item, data: item};
            });
          },
          onSelect: function(suggestion) {
            //$scope.refresh(); TODO
          }
          //appendTo: '#asteroid-lookup-suggestions'
        });
      }
    };
  });
})();
