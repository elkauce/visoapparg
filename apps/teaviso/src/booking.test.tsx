import {render,screen,waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {MemoryRouter,Route,Routes} from "react-router-dom";
import {getFunctionName} from "convex/server";
import {webcrypto} from "node:crypto";
import {afterEach,expect,it,vi} from "vitest";
import {EntryPortal} from "./visitor-v2";
const fixture=vi.hoisted(()=>({book:vi.fn(async()=>({id:"booking-id",status:"confirmed"})),startsAt:Date.now()+86400000}));
vi.mock("convex/react",()=>({
 useQuery:(ref:unknown)=>{
  const name=getFunctionName(ref as Parameters<typeof getFunctionName>[0]);
  if(name==="teaviso_spaces:publicEntry")return {name:"Negocio de prueba",kind:"business",timezone:"America/Argentina/Buenos_Aires",schedule:[],bookings:true,portal:false,templates:[],services:[{id:"service-id",name:"Corte",duration:30}],professionals:[{id:"professional-id",name:"Profesional",serviceIds:["service-id"]}],cancelHours:0,autoConfirm:true,horizonDays:30};
  if(name==="teaviso_spaces:slots")return [{startsAt:fixture.startsAt,professionalId:"professional-id",professionalName:"Display-only metadata"}];
  return null;
 },
 useMutation:()=>fixture.book,
}));
afterEach(()=>vi.unstubAllGlobals());
it("confirms a visitor booking without sending display-only slot metadata to the strict server validator",async()=>{
 vi.stubGlobal("crypto",webcrypto);const user=userEvent.setup();
 const {container}=render(<MemoryRouter initialEntries={["/w/public-token?reservar=1"]}><Routes><Route path="/w/:token" element={<EntryPortal/>}/><Route path="/reserva/:id" element={<h1>Comprobante de reserva</h1>}/></Routes></MemoryRouter>);
 await user.click(screen.getByRole("button",{name:"Continuar",exact:true}));
 await user.click(container.querySelector(".av-slot-grid button")!);
 await user.click(screen.getByRole("button",{name:"Continuar",exact:true}));
 await user.type(screen.getByLabelText("Tu nombre",{exact:true}),"Visita de prueba");
 await user.type(screen.getByLabelText("Correo o teléfono de contacto",{exact:true}),"visitante@fixture.example");
 await user.click(screen.getByRole("checkbox"));
 await user.click(screen.getByRole("button",{name:"Confirmar reserva",exact:true}));
 await waitFor(()=>expect(fixture.book).toHaveBeenCalledTimes(1));
 const args=fixture.book.mock.calls[0][0] as Record<string,unknown>;
 expect(args).toMatchObject({serviceId:"service-id",professionalId:"professional-id",startsAt:fixture.startsAt,name:"Visita de prueba",consent:true});
 expect(args).not.toHaveProperty("professionalName");
 expect(args.manageToken).toMatch(/^[a-f0-9]{64}$/);
 expect(await screen.findByRole("heading",{name:"Comprobante de reserva",exact:true})).toBeVisible();
});
