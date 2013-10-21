(function () {
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
    $rs.width(ww - $ls.width() - 75);
    $rs.height(tch);
    $ls.height(tch);
    $('#results-table-container').height($ls.height() - 15);
  }

  sizeContainers();

  $(window).on('resize', sizeContainers);

  var mod = angular.module('AsterankApp', ['ui.bootstrap', 'utils'])
    .config(function ($interpolateProvider) {
      $interpolateProvider.startSymbol('[[').endSymbol(']]');
    });

  mod.directive('autocomplete', function () {
    return {
      restrict: 'A',
      require: '?ngModel',
      link: function ($scope, element, attrs, ngModel) {
        var $element = $(element);
        //$element.autocomplete('destroy');
        var config = $scope.$eval(attrs.autocomplete);

        if (!config)
          return;

        var onSelect = config.onSelect;
        delete config['onSelect'];

        var autocompleteConfig = {
          serviceUrl: '/api/autocomplete',
          onSelect: function (suggestion) {
            if (ngModel)
              ngModel.$setViewValue(suggestion.value);
            if (attrs.onSelect)
              $scope.$eval(attrs.onSelect);
            if (angular.isFunction(onSelect))
              onSelect();//TODO maybe apply or call
          }
        };
        angular.extend(autocompleteConfig, config);

        //angular.extend(autocompleteConfig, config);

        $element.autocomplete(autocompleteConfig);
      }
    };
  });
})();
