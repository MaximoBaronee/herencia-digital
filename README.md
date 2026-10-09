# front-herencia-digital

Frontend mínimo (React + Vite + ethers v6) para el contrato `DigitalInheritance`.

Repo del backend (contratos): https://github.com/MaximoBaronee/herencia-digital

## Uso local

```bash
# en herencia-digital
npx hardhat node
npx hardhat run scripts/deploy.js --network localhost

# en este repo
cp .env.example .env.local   # pegar la dirección en VITE_CONTRACT_ADDRESS
npm install
npm run dev
```

Para Sepolia: `VITE_CHAIN_ID=11155111`, `VITE_CHAIN_NAME=Sepolia` y la dirección desplegada.

## Estructura

- `src/styles/tokens.css`: tokens de diseño (colores, espaciado, tipografía).
- `src/components/`: `Button`, `Card`, `Stat`, `Badge`, `HeirList`, `Actions`.
- `src/lib/inheritance.ts`: conexión de wallet, lectura del estado y detección de rol.
- `src/abi/DigitalInheritance.json`: ABI exportado de `herencia-digital`.

## Checklist de entrega

Repos del proyecto:

- **Backend (contratos):** https://github.com/MaximoBaronee/herencia-digital
- **Frontend (React):** https://github.com/johanriascos7777/front-herencia-digital

Este checklist es el mismo en ambos repos.

**Hecho**
- [x] Contrato `DigitalInheritance` con CEI, `ReentrancyGuard`, eventos y errores custom.
- [x] NatSpec completo en `/contracts`.
- [x] 43 tests unitarios en verde (incluye reentrancia).
- [x] Scripts `demo`, `demo:cancel` y `deploy` (este último con herederos y plazo por variables de entorno).
- [x] Frontend base: conexión de wallet, detección de rol, dashboard y acciones.

**Backend (`herencia-digital`)**
- [ ] Fondear con Sepolia ETH la wallet de despliegue.
- [ ] Desplegar en Sepolia con `npm run deploy -- --network sepolia`.
- [ ] Verificar el contrato en Etherscan (requiere `ETHERSCAN_API_KEY`).
- [ ] Anotar la dirección desplegada en este README.
- [ ] Reemplazar en el Roadmap la app Android por el frontend web en React.

**Frontend (`front-herencia-digital`)**
- [ ] Probar el flujo completo con MetaMask contra `npx hardhat node`.
- [ ] Crear el sistema de diseño en Claude (Sistema de diseño → New design system → Using Claude Code) apuntando a este repo.
- [ ] Aplicar el diseño con el CSS mínimo necesario.
- [ ] Configurar Sepolia (`VITE_CHAIN_ID`, `VITE_CHAIN_NAME`, `VITE_CONTRACT_ADDRESS`) y probar contra el contrato desplegado.

**Entrega**
- [ ] Grabar el video de presentación y demo (máximo 5 minutos, incluyendo el frontend).
- [ ] Verificar que ambos READMEs expliquen cómo ejecutar y el Roadmap.
- [ ] Subir los cambios a ambos repos.
