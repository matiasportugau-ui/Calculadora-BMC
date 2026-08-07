# Recreation checklist — TruckVisual

- [ ] Read `evidence/grok-build-truckmodel-reply.md` §B–E  
- [ ] Implement `TruckVisual.jsx` props `{ shiftX, truckL }` only  
- [ ] Remap cab rear = `shiftX - 0.02`, bed center = `(shiftX+truckL/2, TRUCK_W/2)`  
- [ ] Axles via `truckAxles.js`  
- [ ] Do not render cargo inside TruckVisual  
- [ ] Keep TruckFloor / HeightGuides / CargoBox  
- [ ] Cab click 10s + stopPropagation  
- [ ] Panelín texture with fallback  
- [ ] Unit test `tests/truckAxles.test.js`  
- [ ] Manual: 6m=2, 8m+=3, free-drag, lights  
