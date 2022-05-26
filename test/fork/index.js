describe('FORK TESTS', function () {

  this.timeout(0)
  this.slow(5000)

  console.log('fork')

  require('./deploy-and-run-uni-v2-clone-strat')
});
