module.exports = {
  testEnvironment: "jsdom",
  setupFilesAfterFramework: ["@testing-library/jest-dom"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "\\.(css|less|scss|sass)$": "<rootDir>/tests/__mocks__/styleMock.js"
  },
  transform: {
    "^.+\\.(js|jsx)$": "babel-jest"
  }
};
