function AsteroidTableCtrl($scope, $http, $filter, pubsub) {
  'use strict';
  var numberFilter = $filter('number');
  var fuzzyFilter = $filter('fuzzynum');
  var ASC_ORDER = $scope.ASC_ORDER = '1';
  var DESC_ORDER = $scope.DESC_ORDER = '-1';
  var UNDEF_ORDER = $scope.UNDEF_ORDER = '0';
  var POSSIBLE_ORDERS = $scope.POSSIBLE_ORDERS = [UNDEF_ORDER, ASC_ORDER, DESC_ORDER];
  var POSSIBLE_LIMITS = $scope.POSSIBLE_LIMITS = [100, 300, 500, 1000, 4000];
  //TODO fill this config
  var POSSIBLE_COLUMNS = $scope.POSSIBLE_COLUMNS = [
    {
      name: 'Name',
      value: 'name',
      orderBy: 'name'
    },
    {
      name: 'Prov des',
      value: 'prov_des',
      orderBy: 'prov_des'
    },
    {
      name: 'Type',
      value: 'spec',
      orderBy: 'spec'
    },
    {
      name: 'α (AU)',
      value: function (asteroid) {
        return numberFilter(asteroid.a, 3);
      },
      orderBy: 'a'
    },
    {
      name: 'e',
      value: function (asteroid) {
        return numberFilter(asteroid.e, 3);
      },
      orderBy: 'e'
    },
    {
      name: 'Value ($)',
      value: function (asteroid) {
        return fuzzyFilter(asteroid.price, 3);
      },
      orderBy: 'price'
    },
    {
      name: 'Est. Profit ($)',
      value: function (asteroid) {
        return fuzzyFilter(asteroid.profit, 3);
      },
      orderBy: 'profit'
    },
    {
      name: '&Delta;v (km/s)',
      value: function (asteroid) {
        return numberFilter(asteroid.dv, 3);
      },
      orderBy: 'dv'
    },
    {
      name: 'Diameter (km)',
      value: 'diameter',
      orderBy: 'diameter'
    },
    {
      name: 'Class',
      value: function (asteroid) {
        return asteroid['class'] ? (asteroid['class'] + (asteroid.pha === 'Y' ? '(PHA)' : '')) : '';
      },
      orderBy: 'class'
    }
  ];

  //Init
  $scope.rankings = [];
  $scope.loading = false;
  $scope.columns = [];

  $scope.requestParams = {
    orderBy: [],
    page: 1,
    limit: POSSIBLE_LIMITS[0]
  };

  //Functions
  //Work with columns
  $scope.addColumn = function addColumn(column) {
    var index = $scope.columns.indexOf(column);
    if (index < 0)
      $scope.columns.push(column);
  };

  $scope.deleteColumn = function deleteColumn(column) {
    var index = $scope.columns.indexOf(column);
    if (index >= 0) {
      $scope.columns.splice(index, 1);
      delete column['order'];
      //TODO delete from ordering
    }
  };

  $scope.upColumn = function upColumn(column) {
    var index = $scope.columns.indexOf(column);
    if (index > 0)
      swap($scope.columns, index, index - 1);
  };

  $scope.downColumn = function downColumn(column) {
    var index = $scope.columns.indexOf(column);
    if (index >= 0 && index + 1 < $scope.columns.length)
      swap($scope.columns, index, index + 1);
  };

  $scope.getValue = function getValue(asteroid, columnValue) {
    return angular.isFunction(columnValue) ? columnValue(asteroid) : asteroid[columnValue];
  };

  //Update rankings
  $scope.refresh = function refresh() {
    $scope.loading = true;
    $http.get('/api/rankings', {params: $scope.requestParams, cache: true})
      .success(function (data) {
        $scope.loading = false;
        $scope.rankings = data;
        // publish to subscribers (incl. 3d view)
        pubsub.publish('NewAsteroidRanking', [$scope.rankings]);
        pubsub.publish('InitialRankingsLoaded');
      });
  };

  $scope.prevPage = function prevPage() {
    $scope.requestParams.page = Math.max(1, $scope.requestParams.page - 1);
    $scope.refresh();
  };

  $scope.nextPage = function nextPage() {
    $scope.requestParams.page++;
    $scope.refresh();
  };

  $scope.orderBy = function (column) {
    var field = column.orderBy;
    if (!field) return;

    var orderBy = $scope.requestParams.orderBy;
    var index = -1;
    for (var i in orderBy)
      if (orderBy.hasOwnProperty(i) && orderBy[i].field === field) {
        index = i;
        break;
      }

    var newDir;
    switch (index | 0) {
      case -1:
        newDir = ASC_ORDER;
        break;
      case 0:
        newDir = nextOrder(orderBy.shift().dir);
        break;
      default :
        newDir = orderBy.splice(index, 1)[0].dir;
        break;
    }

    column.order = newDir;
    if (newDir !== UNDEF_ORDER) {
      orderBy.unshift({field: field, dir: newDir});
    }
    $scope.refresh();
  };

  //TODO init
  for (var i in POSSIBLE_COLUMNS)
    if (POSSIBLE_COLUMNS.hasOwnProperty(i))
      $scope.addColumn(POSSIBLE_COLUMNS[i]);

  $scope.refresh();

  //Helpers
  function swap(collection, ind1, ind2) {
    var tmp = collection[ind1];
    collection[ind1] = collection[ind2];
    collection[ind2] = tmp;
  }

  function nextOrder(order) {
    var index = POSSIBLE_ORDERS.indexOf(order);
    if (index >= 0)
      return POSSIBLE_ORDERS[(index + 1) % POSSIBLE_ORDERS.length];
  }

  $scope.AsteroidClick = function (obj) {
    $scope.selected = obj === $scope.selected ? null : obj;
    pubsub.publish('AsteroidDetailsClick', [obj]);
  };

//    var inserted_asteroids = {};
//    pubsub.subscribe('UpdateRankingsWithFeaturedAsteroid', function (asteroid) {
//        // normal rankings, except we insert a featured asteroid on top
//        $scope.selected = asteroid;
//
//        if (!inserted_asteroids[asteroid.full_name]) {
//            // update rankings
//            $scope.rankings.unshift(asteroid);
//
//            // send new rankings to 3d view
//            pubsub.publish('NewAsteroidRanking', [$scope.rankings]);
//
//            inserted_asteroids[asteroid.full_name] = true;
//        }
//
//        // load details
//        pubsub.publish('AsteroidDetailsClick', [asteroid]);
//    });
//
//    function BroadcastInitialRankingsLoaded() {
//        if ($scope.loading_initial_rankings) {
//            pubsub.publish('InitialRankingsLoaded');
//            $scope.loading_initial_rankings = false;
//        }
//    }
}