module.exports = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["@testing-library/jest-dom"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "\\.(css|less|scss)$": "<rootDir>/tests/__mocks__/styleMock.js",
    "\\.(jpg|jpeg|png|gif|webp|svg|ico)$": "<rootDir>/tests/__mocks__/fileMock.js"
  },
  transform: { "^.+\\.(js|jsx)$": "babel-jest" }
};
