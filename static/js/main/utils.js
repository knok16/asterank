(function () {
  'use strict';

  angular.module('utils', [])
    .controller('SlideShowCtrl', SlideShowCtrl)
    .directive('bindTemplate', CompileDirective)
    .factory('pubsub', PubsubFactory)
    .filter('fuzzynum', FuzzFilter)
    .filter('truncate', TruncateFilter);

  function SlideShowCtrl($scope, $attrs) {
    var blinkInterval = undefined;
    var slideShowControls = $attrs.slideShowControls;
    var slideShowFor = $attrs.slideShowFor;
    if (!$scope[slideShowControls])
      $scope[slideShowControls] = {};

    $scope[slideShowControls].reset = function reset() {
      $scope[slideShowControls].stopBlinking();
      $scope[slideShowControls].currentImage = 0;
    };

    $scope[slideShowControls].startBlinking = function startBlinking() {
      $scope[slideShowControls].pauseBlinking();
      $scope[slideShowControls].blinkingNow = true;
      blinkInterval = setInterval(function () {
        $scope.$apply($scope[slideShowControls].nextImage);
      }, Math.max(1, $scope[slideShowControls].delay | 0) * 1000);
    };

    $scope[slideShowControls].pauseBlinking = function pauseBlinking() {
      if (blinkInterval)
        clearInterval(blinkInterval);
      $scope[slideShowControls].blinkingNow = false;
      blinkInterval = undefined;
    };

    $scope[slideShowControls].stopBlinking = function stopBlinking() {
      $scope[slideShowControls].pauseBlinking();
      $scope[slideShowControls].currentImage = 0;
    };

    $scope[slideShowControls].checkAll = function checkAll(value) {
      var slideShowCollection = $scope[slideShowFor];
      for (var i in slideShowCollection)
        if (slideShowCollection.hasOwnProperty(i))
          slideShowCollection[i].checked = !!value;
    };

    $scope[slideShowControls].nextImage = function nextImage() {
      $scope[slideShowControls].currentImage = getNextImage($scope[slideShowControls].currentImage, forwardDirection);
    };

    $scope[slideShowControls].prevImage = function prevImage() {
      $scope[slideShowControls].currentImage = getNextImage($scope[slideShowControls].currentImage, backwardDirection);
    };

    function forwardDirection(currentImage, n) {
      return (currentImage + 1) % n;
    }

    function backwardDirection(currentImage, n) {
      return (currentImage - 1 + n) % n;
    }

    function getNextImage(currentImage, directionFn) {
      var slideShowCollection = $scope[slideShowFor];
      var i = 0, n = slideShowCollection.length;
      do {
        currentImage = directionFn(currentImage | 0, n);
        i++;
      } while (!slideShowCollection[currentImage].checked && i < n);
      return currentImage;
    }

    $scope[slideShowControls].reset();
  }

  function CompileDirective($compile) {
    return function (scope, element, attrs) {
      scope.$watch(
        function (scope) {
          // watch the 'compile' expression for changes
          return scope.$eval(attrs.bindTemplate);
        },
        function (value) {
          // when the 'compile' expression changes
          // assign it into the current DOM
          element.html(value);

          // compile the new DOM and link it to the current scope.
          // NOTE: we only compile .childNodes so that
          // we don't get into infinite loop compiling ourselves
          $compile(element.contents())(scope);
        }
      );
    };
  }

  function PubsubFactory() {
    // https://gist.github.com/floatingmonkey/3384419
    var cache = {};
    return {
      publish: function (topic, args) {
        cache[topic] && $.each(cache[topic], function () {
          try {
            this.apply(null, args || []);
          } catch (e) {
            console.error(e.stack);
          }
        });
      },

      subscribe: function (topic, callback) {
        if (!cache[topic]) {
          cache[topic] = [];
        }
        cache[topic].push(callback);
        return [topic, callback];
      },

      unsubscribe: function (handle) {
        var t = handle[0];
        cache[t] && d.each(cache[t], function (idx) {
          if (this == handle[1]) {
            cache[t].splice(idx, 1);
          }
        });
      }
    }
  }

  function FuzzFilter() {
    var fuzzes = [
      {
        word: 'trillion',
        num: 1000000000000
      },
      {
        word: 'billion',
        num: 1000000000
      },
      {
        word: 'million',
        num: 1000000
      }
    ];

    return toFuzz;

    function toFuzz(n) {
      if (n < 0.1) {
        return 0;
      }
      for (var i = 0; i < fuzzes.length; i++) {
        var x = fuzzes[i];
        if (n / x.num >= 1) {
          var prefix = (n / x.num);
          if (i == 0 && prefix > 100)
            return '>100 ' + x.word;
          return prefix.toFixed(2) + ' ' + x.word;
        }
      }
      return n;
    }
  }

  function TruncateFilter() {
    return truncateText;

    function truncateText(txt, len) {
      if (txt.length > len) {
        txt = txt.substring(0, len - 3) + '...';
      }
      return txt;
    }
  }
})();