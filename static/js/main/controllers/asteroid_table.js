function AsteroidTableCtrl($scope, $http, pubsub) {
  'use strict';
  var ASC_ORDER = $scope.ASC_ORDER = '1';
  var DESC_ORDER = $scope.DESC_ORDER = '-1';
  var UNDEF_ORDER = $scope.UNDEF_ORDER = '0';
  var POSSIBLE_ORDERS = $scope.POSSIBLE_ORDERS = [UNDEF_ORDER, ASC_ORDER, DESC_ORDER];
  //TODO set to 1 while server doesn't work correct for several fields
  var MAX_COLUMNS_FOR_SORTING = 1;
  var POSSIBLE_LIMITS = $scope.POSSIBLE_LIMITS = [10, 50, 100, 300, 500];
  //TODO fill this config
  var POSSIBLE_COLUMNS = $scope.POSSIBLE_COLUMNS = [
//    {
//      title: //title template
//      template: //cell template
//      field: //field in asteroid object - optional
//      sortable: //boolean - can user sort data by this column
//      searchable: //boolean - can user search by this column
//    },
    {
      title: 'Name',
      template: '[[asteroid.name || "-"]]',
      field: 'name',
      sortable: true,
      searchable: true,
      autocomplete: {
        minChars: 3,
        params:{
          field:'name'
        },
        transformResult: angular.identity
      }
    },
    {
      title: 'Prov des',
      template: '[[asteroid.prov_des]]',
      field: 'prov_des',
      sortable: true,
      searchable: true,
      autocomplete: {
        minChars: 2,
        params:{
          field:'prov_des'
        },
        transformResult: angular.identity
      }
    },
    {
      title: 'Type',
      template: '[[asteroid.spec]]',
      field: 'spec',
      sortable: true,
      searchable: true
    },
    {
      title: 'α (AU) <i class="icon-info-sign icon-white" title="Semi-major Axis"></i>',
      template: '[[asteroid.a | number:3]]',
      field: 'a',
      sortable: true,
      searchable: true
    },
    {
      title: 'e <i class="icon-info-sign icon-white" title="Eccentricity"></i>',
      template: '[[asteroid.e | number:3]]',
      field: 'e',
      sortable: true,
      searchable: true
    },
    {
      title: 'Value ($)',
      template: '[[asteroid.price | fuzzynum]]',
      field: 'price',
      sortable: true,
      searchable: true
    },
    {
      title: 'Est. Profit ($)',
      template: '[[asteroid.profit | fuzzynum]]',
      field: 'profit',
      sortable: true,
      searchable: true
    },
    {
      title: 'Δv (km/s)',
      template: '[[asteroid.dv | number:3]]',
      field: 'dv',
      sortable: true,
      searchable: true
    },
    {
      title: 'Diameter (km)',
      template: '[[asteroid.diameter]]',
      field: 'diameter',
      sortable: true,
      searchable: true
    },
    {
      title: 'Class',
      template: '[[asteroid.class]]<span ng-show="asteroid.pha == \'Y\'">(PHA)</span>',
      field: 'class',
      sortable: true,
      searchable: true,
      autocomplete: {
        minChars: 0,
        params:{
          field:'class'
        },
        transformResult: angular.identity
      }
    }
  ];

  //Init
  $scope.rankings = [];
  $scope.loading = false;
  $scope.columns = [];

  $scope.requestParams = {
    sortBy: [],
    searchCriteria: {},
    page: 1,
    limit: POSSIBLE_LIMITS[0]
  };

  //Functions
  //Work with columns
  $scope.addColumn = function addColumn(column) {
    var index = $scope.columns.indexOf(column);
    if (index < 0) {
      $scope.columns.push(column);
      column.selected = true;
    }
  };

  $scope.deleteColumn = function deleteColumn(column) {
    var index = $scope.columns.indexOf(column);
    if (index >= 0) {
      $scope.columns.splice(index, 1);
      column.selected = false;
      column.sortDir = UNDEF_ORDER;
      delete $scope.requestParams.searchCriteria[column.field];
      index = $scope.requestParams.sortBy.indexOf(column);
      if (index >= 0)
        $scope.requestParams.sortBy.splice(index, 0);
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

  //Update rankings
  $scope.refresh = function refresh() {
    $scope.loading = true;
    var sortBy = [];
    angular.forEach($scope.requestParams.sortBy, function (value) {
      sortBy.push({field: value.field, dir: value.sortDir});
    });
    $http.get('/api/rankings',
      {
        params: {
          limit: $scope.requestParams.limit,
          page: $scope.requestParams.page,
          searchCriteria: $scope.requestParams.searchCriteria,
          sortBy: sortBy
        },
        cache: true
      }).success(function (data) {
        $scope.loading = false;
        $scope.rankings = data.ranking;
        $scope.requestParams.dataCount = data.count;
        //TODO think about it and rework
        $scope.requestParams.page = data.page || $scope.requestParams.page;
        $scope.requestParams.pageCount = ((data.count / $scope.requestParams.limit) | 0) + (data.count % $scope.requestParams.limit ? 1 : 0);
        // publish to subscribers (incl. 3d view)
        pubsub.publish('NewAsteroidRanking', [$scope.rankings]);
        pubsub.publish('InitialRankingsLoaded');
      }).error(function () {
        //TODO add error handler
        $scope.loading = false;
      });
  };

  $scope.prevPage = function prevPage() {
    $scope.requestParams.page = Math.max(1, $scope.requestParams.page - 1);
    $scope.refresh();
  };

  $scope.nextPage = function nextPage() {
    $scope.requestParams.page = Math.min($scope.requestParams.pageCount, $scope.requestParams.page + 1);
    $scope.refresh();
  };

  $scope.sortBy = function (column) {
    if (!column.sortable) return;

    var sortBy = $scope.requestParams.sortBy;
    var index = sortBy.indexOf(column);

    var newDir;
    switch (index) {
      case -1:
        newDir = ASC_ORDER;
        break;
      case 0:
        newDir = nextOrder(sortBy.shift().sortDir);
        break;
      default :
        newDir = sortBy.splice(index, 1)[0].sortDir;
        break;
    }

    column.sortDir = newDir;
    if (newDir !== UNDEF_ORDER) {
      sortBy.unshift(column);
    }
    while (sortBy.length > MAX_COLUMNS_FOR_SORTING) {
      column = sortBy.pop();
      column.sortDir = UNDEF_ORDER;
    }
    $scope.refresh();
  };

  $scope.clearFilters = function clearFilters() {
    $scope.requestParams.searchCriteria = {};
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
    return index >= 0 ? POSSIBLE_ORDERS[(index + 1) % POSSIBLE_ORDERS.length] : UNDEF_ORDER;
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