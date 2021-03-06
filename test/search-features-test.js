'use strict'

const mongoose = require('mongoose')
const async = require('async')
const config = require('./config')
const Schema = mongoose.Schema
const mongoosastic = require('../lib/mongoosastic')

const BondSchema = new Schema({
  name: String,
  type: {
    type: String,
    default: 'Other Bond'
  },
  price: Number
})

BondSchema.plugin(mongoosastic)

const Bond = mongoose.model('Bond', BondSchema)

describe('Query DSL', function () {
  before(function (done) {
    mongoose.connect(config.mongoUrl, function () {
      Bond.remove(function () {
        config.deleteIndexIfExists(['bonds'], function () {
          const bonds = [
            new Bond({
              name: 'Bail',
              type: 'A',
              price: 10000
            }),
            new Bond({
              name: 'Commercial',
              type: 'B',
              price: 15000
            }),
            new Bond({
              name: 'Construction',
              type: 'B',
              price: 20000
            }),
            new Bond({
              name: 'Legal',
              type: 'C',
              price: 30000
            })
          ]
          async.forEach(bonds, config.saveAndWaitIndex, function () {
            setTimeout(done, config.INDEXING_TIMEOUT)
          })
        })
      })
    })
  })

  after(function (done) {
    Bond.remove()
    Bond.esClient.close()
    mongoose.disconnect()
    done()
  })

  describe('range', function () {
    it('should be able to find within range', function (done) {
      Bond.search({
        range: {
          price: {
            from: 20000,
            to: 30000
          }
        }
      }, function (err, res) {
        res.hits.total.should.eql(2)
        res.hits.hits.forEach(function (bond) {
          ['Legal', 'Construction'].should.containEql(bond._source.name)
        })

        done()
      })
    })
  })

  describe('Sort', function () {
    const getNames = function (res) {
      return res._source.name
    }
    const expectedDesc = ['Legal', 'Construction', 'Commercial', 'Bail']
    const expectedAsc = expectedDesc.concat([]).reverse() // clone and reverse

    describe('Simple sort', function () {
      it('should be able to return all data, sorted by name ascending', function (done) {
        Bond.search({
          match_all: {}
        }, {
          sort: 'name.keyword:asc'
        }, function (err, res) {
          res.hits.total.should.eql(4)
          expectedAsc.should.eql(res.hits.hits.map(getNames))

          done()
        })
      })

      it('should be able to return all data, sorted by name descending', function (done) {
        Bond.search({
          match_all: {}
        }, {
          sort: ['name.keyword:desc']
        }, function (err, res) {
          res.hits.total.should.eql(4)
          expectedDesc.should.eql(res.hits.hits.map(getNames))

          done()
        })
      })
    })

    describe('Complex sort', function () {
      it('should be able to return all data, sorted by name ascending', function (done) {
        Bond.search({
          match_all: {}
        }, {
          sort: {
            'name.keyword': {
              order: 'asc'
            }
          }
        }, function (err, res) {
          res.hits.total.should.eql(4)
          expectedAsc.should.eql(res.hits.hits.map(getNames))

          done()
        })
      })

      it('should be able to return all data, sorted by name descending', function (done) {
        Bond.search({
          match_all: {}
        }, {
          sort: {
            'name.keyword': {
              order: 'desc'
            },
            'type.keyword': {
              order: 'asc'
            }
          }
        }, function (err, res) {
          res.hits.total.should.eql(4)
          expectedDesc.should.eql(res.hits.hits.map(getNames))

          done()
        })
      })
    })
  })

  describe('Aggregations', function () {
    describe('Simple aggregation', function () {
      it('should be able to group by term', function (done) {
        Bond.search({
          match_all: {}
        }, {
          aggs: {
            'names': {
              'terms': {
                'field': 'name.keyword'
              }
            }
          }
        }, function (err, res) {
          res.aggregations.names.buckets.should.eql([
            {
              doc_count: 1,
              key: 'Bail'
            },
            {
              doc_count: 1,
              key: 'Commercial'
            },
            {
              doc_count: 1,
              key: 'Construction'
            },
            {
              doc_count: 1,
              key: 'Legal'
            }
          ])

          done()
        })
      })
    })
  })

  describe('test', function () {
    it('should do a fuzzy query', function (done) {
      const getNames = function (res) {
        return res._source.name
      }

      Bond.search({
        match: {
          name: {
            query: 'comersial',
            fuzziness: 2
          }
        }
      }, function (err, res) {
        res.hits.total.should.eql(1);
        ['Commercial'].should.eql(res.hits.hits.map(getNames))
        done()
      })
    })
  })
})
