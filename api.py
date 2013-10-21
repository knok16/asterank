import re
import datetime
import pymongo
import math
from pymongo import MongoClient

import calc.horizon as horizon
from calc.jpl_lookup import Asteroid as JPL_Asteroid

conn = MongoClient()
db = conn.asterank
asteroids = db.asteroids
mpc_coll = db.mpc
jpl = db.jpl
kepler_coll = db.kepler
exoplanets_coll = db.exo
user_objects_coll = db.user_objects

UPCOMING_SORT = 'upcoming'
SMALL_SIZE_SORT = 'smallest'

VALID_SORTS = set(['value', 'profit', 'accessibility', 'score', UPCOMING_SORT, \
    SMALL_SIZE_SORT])

ORBIT_FIELDS = ['prov_des', 'full_name', 'price', 'profit', 'a', 'e', 'i', \
    'om', 'ma', 'n', 'w', 'per', 'epoch']

# some of these were poorly named, so we map better names, but the database stays the
# same for backwards compatibility
FIELD_ALIASES = {
  'value': 'price',
  'accessibility': 'closeness',
}

#TODO set to 1 while server doesn't work correct for several fields
# add corresponded indexes to db to increas this value
MAX_COLUMNS_FOR_SORTING = 1

def prepare_like_criteria(query):
  return re.compile(query, re.IGNORECASE)

def parse_number(str):
  # match
  # 1st group: (+|-int) - integer part
  # 2nd group: (.int) - fractal part
  # 3rd group: trillion|billion|million or prefix
  match = re.match('^((?:-|\+)?\d+)(\.\d*)?(.*)$', str)
  if match:
    g1 = match.group(1)
    g2 = match.group(2)
    g3 = match.group(3).lower()
    result = int(g1)
    if g2:
      result += float(g2)
    if g3:
      if 'million'.startswith(g3):
        result *= 1000000
      elif 'billion'.startswith(g3):
        result *= 1000000000
      elif 'trillion'.startswith(g3):
        result *= 1000000000000
    return result
  else:
    return 0

def prepare_number_criteria(query):
  query = ''.join(query.split()) # Delete all whitespaces
  if query.startswith('<='):
    return {'$lte': parse_number(query[2:])}
  elif query.startswith('<'):
    return {'$lt': parse_number(query[1:])}
  elif query.startswith('>='):
    return {'$gte': parse_number(query[2:])}
  elif query.startswith('>'):
    return {'$gt': parse_number(query[1:])}
  elif '~' in query:
    split_result = query.split('~')
    first_part = split_result[0]
    second_part = split_result[1]
    return {'$gte': parse_number(first_part), '$lte': parse_number(second_part)}
  else:
    return query

#TODO extend
HOW_PREPARE_FIELD = {
  'name': prepare_like_criteria,
  'prov_des': prepare_like_criteria,
  #'spec': return_exact_field,
  'a': prepare_number_criteria,
  'e': prepare_number_criteria,
  'price': prepare_number_criteria,
  'profit': prepare_number_criteria,
  'dv': prepare_number_criteria,
  'diameter': prepare_number_criteria,
  #'class': return_exact_field,
}

def prepare_search_criteria(search_criteria):
  result = {}
  for key in search_criteria:
    currentCriteria = search_criteria[key]
    if currentCriteria:
      if key in HOW_PREPARE_FIELD:
        result[key] = HOW_PREPARE_FIELD[key](currentCriteria)
      else:
        result[key] = currentCriteria
  return result

def rankings(search_criteria, order_by, limit, page, orbits_only=False):
  #TODO add upcoming passes

  #preparing data for query
  search_criteria = prepare_search_criteria(search_criteria)
  order_by = order_by[:MAX_COLUMNS_FOR_SORTING]
  page = max(1, page)
  limit = max(1, limit)
  skip_count = (page-1)*limit

  fields = {}
  if orbits_only:
    fields = {field: True for field in ORBIT_FIELDS}
  fields['_id'] = False

  t = asteroids.find(search_criteria, fields)
  if (order_by):
    sortCriteria = []
    for val in order_by:
      sortCriteria.append((val[u'field'], int(val[u'dir'])))
    t = t.sort(sortCriteria)
  count = t.count()
  if (skip_count>=count):
    page = (count / limit) + (1 if count%limit else 0)
    skip_count = max(0, (page-1)*limit)

  results = t.skip(skip_count).limit(limit)

  # remove empty fields
  ret = []
  for obj in results:
    appendme = {key:val for key,val in obj.iteritems() if val != ''}
    # Some sanitation for a python json serialization bug where very
    # small numbers are serialized to -Infinity, breaking client JSON parsing.
    if appendme['price'] < 1:
      appendme['price'] = 0
    if appendme['profit'] < 1:
      appendme['profit'] = 0
    ret.append(appendme)
  return {'ranking': ret, 'count': count, 'page': page}

def autocomplete(field, query, limit):
  # TODO think about it
  query = query.replace('+', ' ').lower()
  regx = re.compile(query, re.IGNORECASE)
  ret = asteroids.find({field: regx}, {field: True}).distinct(field)[:limit]
  # this sorting is not quite exact, as it penalizes asteroids with
  # long prefix numbers.  But it's close enough.
  #return sorted(ret, key=lambda x: x['full_name'].lower().find(query))[:limit]
  return ret

def compositions():
  return horizon.compositions()

def upcoming_passes():
  jpl_objs = jpl.find({'Next Pass': {'$exists': True, '$ne': None}, \
    'Next Pass.date_iso': {'$gte': datetime.datetime.now().isoformat()}}, \
    {'_id': False},) \
    .sort('Next Pass.date_iso', direction=pymongo.ASCENDING).limit(30)

  ret = []
  seen = set()
  # TODO this is why the db should be relational...
  for result in jpl_objs:
    if result['tag_name'] in seen:
      continue
    roid = asteroids.find_one({'prov_des': result['tag_name']}, {'_id': False})
    seen.add(result['tag_name'])
    ret.append(roid)

  return ret

def ranking_by_smallest(limit, fields):
  return list(asteroids.find({'diameter': {'$ne': ''}}, fields) \
      .sort('diameter', direction=pymongo.ASCENDING).limit(limit));

def jpl_lookup(query):
  result = jpl.find_one({'tag_name': query}, {'_id': False})
  if not result:
    print 'JPL lookup: %s not found in cache...' % query
    # maybe it's not cached; try querying for it from horizons
    try:
      a = JPL_Asteroid(query)
      a.load()
      print 'JPL lookup: %s loaded from JPL' % query
      result = a.data
      result['tag_name'] = query
      jpl.insert(result)  # cache
      del result['_id']
    except:
      print 'JPL lookup: %s lookup failed' % query
      return None
  else:
    print 'JPL lookup: %s found in cache' % query

  del result['tag_name']
  return result

def mpc(query, limit):
  return list(mpc_coll.find(query, {'_id': False}).limit(limit))

def kepler(query, limit):
  return list(kepler_coll.find(query, {'_id': False}).limit(limit))

def exoplanets(query, limit):
  #return list(exoplanets_coll.find(query, {'_id': False}).limit(limit))

  REQ_TO_DB_MAP = {
    'full_name': 'kepoi_name',
    'prov_des': 'kepoi_name',
    'a': 'koi_sma',
    'e': 'koi_eccen',
    'i': 'koi_incl',
    'w_bar': 'koi_longp',
    'P': 'koi_period',

    # extras
    'p_radius': 'koi_prad',  # planet radius (rearth)
    'p_temp': 'koi_teq',  # equilibrium temperature value (k)
    's_radius': 'koi_srad',  # stellar radius (rsun)
    's_temp': 'koi_steff',  # stellar effective temp (k)
    's_age': 'koi_sage',   # stellar age (Gyr)
  }

  RESP_DEFAULTS = {
    'e': 0.01671122945845127,
    'i': 0,
    'w_bar': 102.93768193,

    'ma': -2.4731102699999923,
    'om': 0,
  }

  for key in query:
    if key in REQ_TO_DB_MAP:
      val = query[key]
      del query[key]
      query[REQ_TO_DB_MAP[key]] = val

  # TODO add sort to request, limit is not used
  results = list(exoplanets_coll.find(query, {'_id': False}) \
      .sort('koi_sma', direction=pymongo.DESCENDING))

  final = []

  # TODO all this should be moved in processing
  for result in results:
    if result['koi_disposition'] != 'FALSE POSITIVE' \
        or result['koi_pdisposition'] != 'FALSE POSITIVE':
      continue

    appendme = {
      # defaults...
      'o': 0,  # long. ascending node
      'ma': 0,   # mean anomaly
      'epoch': 2451545.0,  # j2000
    }
    for key, val in REQ_TO_DB_MAP.iteritems():
      appendme[key] = result[val]
    # real period, not transit period
    #appendme['a'] *= 20
    appendme['P'] = math.sqrt(appendme['a'] ** 3) * 365.25   # http://galacticfool.com/orbital-distance-and-orbital-period/
    if appendme['i'] != '':
      appendme['i'] -= 90
    for key, default in RESP_DEFAULTS.iteritems():
      if key not in appendme or appendme[key] == '' or appendme[key] == 0:
        appendme[key] = default
    final.append(appendme)
  return final

def asterank(query, limit):
  results = list(asteroids.find(query, {'_id': False}).limit(limit))
  #key_whitelist = set(['a', 'e', 'i', 'om', 'ma', 'spec', 'GM', 'dv', ])  # TODO complete
  #results = [{key: asteroid[key] for key in key_whitelist} for asteroid in results]
  return results

def insert_user_object(obj, image_keys):
  obj['s3_image_keys'] = image_keys if image_keys else []
  user_objects_coll.insert(obj)
  return {'success': True}

def retrieve_user_objects(limit):
  return list(user_objects_coll.find({}, {'_id': False}).limit(limit))
