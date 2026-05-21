module.exports = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["@testing-library/jest-dom"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "\\.(css|less|scss)$": "<rootDir>/tests/__mocks__/styleMock.js"
  },
  transform: { "^.+\\.(js|jsx)$": "babel-jest" }
};
