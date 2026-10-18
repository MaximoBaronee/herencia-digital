// Configuración de solidity-coverage: los mocks son código auxiliar de los tests,
// no forman parte del sistema desplegado, así que no entran en la medición.
module.exports = {
  skipFiles: ["mocks/"],
};
