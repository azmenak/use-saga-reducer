module.exports = {
  preset: 'ts-jest',
  globals: {
    'ts-jest': {
      isolatedModules: true
    }
  },
  collectCoverage: true,
  coverageDirectory: './coverage',
  roots: ['src']
}
