function AsteroidDetailsCtrl($scope, $http, pubsub) {
  'use strict';

  var MPC_FIELDS_TO_INCLUDE = {
    // Already in JPL fields:
    /*
    'a': {
      'name': 'Semimajor Axis',
      'units': 'AU'
    },
    'i': {
      'name': 'Inclination',
      'units': 'deg'
    },
    */
    'e': {
      'name': 'Eccentricity'
    },
    'epoch': {
      'name': 'Epoch'
    },
    'dv': {
      'name': 'Delta-v',
      'units': 'km/s'
    },
    'diameter': {
      'name': 'Diameter',
      'units': 'km'
    },
    'ma': {
      'name': 'Mean Anomaly',
      'units': 'deg @ epoch'
    },
    'om': {
      'name': 'Longitude of Ascending Node',
      'units': 'deg @ J2000'
    },
    'w': {
      'name': 'Argument of Perihelion',
      'units': 'deg @ J2000'
    }
  };

  $scope.asteroid = null;
  $scope.asteroid_details = null;

  $scope.init = function() {
    $scope.resetView();
  };

  $scope.resetView = function() {
    $scope.approaches = [];      // upcoming approaches
    $scope.composition = [];
    $scope.images = [];
    $scope.images_loading = true;
    if ($scope.ssControl)
        $scope.ssControl.stopBlinking();
  };

  var jpl_cache = new SimpleCache();
  var compositions_map = null;

  pubsub.subscribe('AsteroidDetailsClick', function(asteroid) {
    if ($scope.asteroid
      && asteroid.full_name === $scope.asteroid.full_name) {
      // already selected
      $scope.asteroid = null;
      $scope.resetView();
      pubsub.publish('ShowIntroStatement');
      pubsub.publish('Default3DView');
      return;
    }

    // Update detailed click view
    $scope.asteroid = asteroid;
    $scope.resetView();

    // Flat fields that we just want to display
    $scope.stats = [];

    pubsub.publish('HideIntroStatement');

    // grab jpl asteroid details
    var query = $scope.asteroid.prov_des || $scope.asteroid.full_name;
    var cache_result = jpl_cache.Get(query);
    if (cache_result) {
      ShowData(cache_result);
    }
    else {
      $http.get('/jpl/lookup?query=' + query)
        .success(function(data) {
          ShowData(data);
          jpl_cache.Set($scope.asteroid.full_name, data);
      });
    }
    ShowOrbitalDiagram();

    // Lock 3d view
    pubsub.publish('Lock3DView', [asteroid]);
  });

  function ShowData(data) {
    // JPL data from main view
    for (var attr in data) {
      if (!data.hasOwnProperty(attr)) continue;
      if (typeof data[attr] !== 'object') {
        if (data[attr] != -1) {
          $scope.stats.push({
            // TODO these need to have units as a separate structure attr
            name: attr.replace(/(.*?)\(.*?\)/, "$1"),
            units: attr.replace(/.*?\((.*?)\)/, "$1"),
            value: data[attr]
          });
        }
      }
    }

    // JPL data includes MPC data
    for (var attr in MPC_FIELDS_TO_INCLUDE) {
      if (!MPC_FIELDS_TO_INCLUDE.hasOwnProperty(attr)) continue;
      var val = MPC_FIELDS_TO_INCLUDE[attr];
      $scope.stats.push({
        name: val.name,
        units: val.units,
        value: $scope.asteroid[attr]
      });
    }

    // special fields: next pass and close approaches
    $scope.approaches = data['Close Approaches'];

    if ($scope.asteroid.custom_object) {
      $scope.images = [];
      $scope.images_loading = false;
    }
    else {
      // Composition data
      if (compositions_map) {
        // Object.keys not supported < ie9, so shim is required (see misc.js)
        $scope.composition = Object.keys(compositions_map[$scope.asteroid.spec]);
      }
      else if ($scope.asteroid.spec) {    // This is not set when object is passed via &object param
        $http.get('/api/compositions').success(function(data) {
          var compositions_map = data;
          $scope.composition =
            Object.keys(compositions_map[$scope.asteroid.spec]);
        });
      }

      // Imagery data!
      var imagery_req_url = '/api/skymorph/images_for?target=' + $scope.asteroid.prov_des;
      var requesting_images_for = $scope.asteroid.prov_des;
      $http.get(imagery_req_url).success(function(data) {
        if ($scope.asteroid.prov_des == requesting_images_for) {
          $scope.images = data.images;
          $scope.images_loading = false;
          $scope.ssControls.checkAll(true);
        }
      });
    }
  }

  function ShowOrbitalDiagram() {
    // Orbital diagram
    var orbit_diagram = new OrbitDiagram('#orbit-2d-diagram', {});
    orbit_diagram.render(
        $scope.asteroid.a,
        $scope.asteroid.e,
        $scope.asteroid.w
    );
  }
}