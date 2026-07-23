// Registra os matchers do jest-dom (toBeInTheDocument, toHaveTextContent, ...)
// na instância de expect do vitest, e liga a limpeza automática do DOM entre os
// testes de componente (@testing-library/react faz o afterEach com globals: true).
import "@testing-library/jest-dom/vitest";
