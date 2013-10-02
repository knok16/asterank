(function(){
    'use strict';

    angular.module('utils', [])
        .controller('SlideShowCtrl', SlideShowCtrl);

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
            blinkInterval = setInterval(function(){
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
            for(var i in slideShowCollection)
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
})();