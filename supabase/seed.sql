-- ============================================================
--  Examen de Español — örnek içerik (isteğe bağlı)
--  Paneldeki "Test Soruları / Yazma / Konuşma" bölümlerinden
--  kendi içeriğini ekleyebilirsin. Bu dosya sadece ilk kurulumda
--  akışı test etmen için 10 soru ve birer konu ekler.
--  Tekrar çalıştırıldığında mevcut sorular varsa hiçbir şey yapmaz.
-- ============================================================

do $$
begin
  if exists (select 1 from public.questions limit 1) then
    raise notice 'Seed atlandı: sorular zaten var.';
    return;
  end if;

  insert into public.questions (level, prompt, options, correct_index, position) values
  -- ------------------------------- A1 -------------------------------
  ('A1', 'Completa: «¿Cómo ___?»', '["te llamas","te llama","se llamas","llamas"]', 0, 1),
  ('A1', 'Completa: «Yo ___ de Turquía.»', '["estoy","soy","es","eres"]', 1, 2),
  ('A1', 'Completa: «Nosotros ___ estudiantes.»', '["estamos","son","somos","es"]', 2, 3),
  ('A1', 'Completa: «El libro ___ encima de la mesa.»', '["es","está","hay","son"]', 1, 4),
  ('A1', 'Completa: «¿___ años tienes?»', '["Cuanto","Cuántos","Cuántas","Que"]', 1, 5),
  ('A1', 'Completa: «Me gusta ___ café.»', '["la","el","los","las"]', 1, 6),
  ('A1', 'Completa: «Los lunes ___ al gimnasio.»', '["voy","vas","va","vamos"]', 0, 7),
  ('A1', 'Completa: «Ella ___ española.»', '["está","es","son","soy"]', 1, 8),
  ('A1', 'Completa: «¿Dónde ___ el baño?»', '["es","hay","está","están"]', 2, 9),
  ('A1', 'Completa: «Mi hermana ___ Ana.»', '["se llaman","me llamo","se llama","llama"]', 2, 10),
  -- ------------------------------- A2 -------------------------------
  ('A2', 'Completa: «Ayer ___ al cine con mis amigos.»', '["fui","voy","iba","iré"]', 0, 1),
  ('A2', 'Completa: «Cuando era niño, ___ mucho en el parque.»', '["jugaba","jugué","juego","jugaré"]', 0, 2),
  ('A2', 'Completa: «¿Ya ___ la tarea?»', '["haces","has hecho","hacías","harás"]', 1, 3),
  ('A2', 'Completa: «Este verano ___ a Grecia.»', '["vamos a ir","fuimos","íbamos","hemos ido"]', 0, 4),
  ('A2', 'Completa: «Me duele ___ cabeza.»', '["el","la","los","las"]', 1, 5),
  ('A2', 'Completa: «Es más alto ___ su hermano.»', '["de","que","como","tan"]', 1, 6),
  ('A2', 'Completa: «Si lloviera, ___ en casa.»', '["nos quedamos","nos quedaríamos","nos quedábamos","quedamos"]', 1, 7),
  ('A2', 'Completa: «___ gustan las películas de terror.»', '["Me","Mi","Yo","Mí"]', 0, 8),
  ('A2', 'Completa: «___ las ocho de la mañana.»', '["Es","Son","Está","Hay"]', 1, 9),
  ('A2', 'Completa: «Anoche ___ una película muy buena.»', '["veo","vi","veía","veré"]', 1, 10),
  -- ------------------------------- B1 -------------------------------
  ('B1', 'Completa: «Ojalá ___ buen tiempo mañana.»', '["hace","haga","hizo","hará"]', 1, 1),
  ('B1', 'Completa: «Cuando llegué, ellos ya ___.»', '["se iban","se habían ido","se irán","se vayan"]', 1, 2),
  ('B1', 'Completa: «Si tuviera dinero, ___ un coche.»', '["compro","compraría","compraba","compre"]', 1, 3),
  ('B1', 'Completa: «Es importante que ___ todos los días.»', '["practicas","practiques","practicaste","practicar"]', 1, 4),
  ('B1', 'Completa: «No creo que ___ verdad.»', '["es","sea","era","será"]', 1, 5),
  ('B1', 'Completa: «Llevo dos años ___ español.»', '["estudio","estudiando","estudiar","estudiado"]', 1, 6),
  ('B1', 'Completa: «Aunque ___ cansado, terminó el trabajo.»', '["está","estaba","esté","estar"]', 1, 7),
  ('B1', 'Completa: «Me pidió que le ___ la puerta.»', '["abro","abriera","abriré","abrir"]', 1, 8),
  ('B1', 'Completa: «Antes de ___, desayuno.»', '["salgo","salir","saliendo","salido"]', 1, 9),
  ('B1', 'Completa: «El libro ___ que te hablé es interesante.»', '["que","del","el","de"]', 1, 10),
  -- ------------------------------- B2 -------------------------------
  ('B2', 'Completa: «No es que no me guste, ___ que no tengo tiempo.»', '["pero","sino","aunque","si no"]', 1, 1),
  ('B2', 'Completa: «De haberlo sabido, ___ venido.»', '["había","habría","habrá","hubo"]', 1, 2),
  ('B2', 'Completa: «Por mucho que ___, no lo conseguirás.»', '["insistes","insistas","insistirás","insististe"]', 1, 3),
  ('B2', 'Completa: «En cuanto ___ el informe, te lo envío.»', '["termino","termine","terminaré","terminaba"]', 1, 4),
  ('B2', 'Completa: «A menos que ___, podremos salir.»', '["llueve","llueva","lloverá","llovía"]', 1, 5),
  ('B2', 'Completa: «Cuanto más practiques, ___ hablarás.»', '["mejor","más bien","bueno","bien"]', 0, 6),
  ('B2', 'Completa: «No cabe ___ que es un gran profesional.»', '["duda","dudas","una duda","dudar"]', 0, 7),
  ('B2', 'Completa: «Le dije que me ___ cuando llegara.»', '["llama","llamara","llamará","llame"]', 1, 8),
  ('B2', 'Completa: «Se trata de un tema ___ importancia.»', '["de gran","de grande","gran","muy"]', 0, 9),
  ('B2', 'Completa: «Hace falta que ___ más recursos.»', '["hay","haya","habrá","hubo"]', 1, 10),
  -- ------------------------------- C1 -------------------------------
  ('C1', 'Completa: «Los datos, ___ fiabilidad es cuestionable, no sirven.»', '["cuyo","cuya","cuyos","que su"]', 1, 1),
  ('C1', 'Completa: «Pese a ___, el equipo mantuvo la calma.»', '["las críticas","los críticas","la crítica","críticas"]', 0, 2),
  ('C1', 'Completa: «Actuó como si nada ___ ocurrido.»', '["había","hubiera","ha","haya"]', 1, 3),
  ('C1', 'Completa: «A fin de ___ el problema, contrataron a un experto.»', '["resolver","resuelven","resolviendo","resolvió"]', 0, 4),
  ('C1', 'Completa: «Es probable que ya ___ terminado.»', '["han","hayan","habrán","habían"]', 1, 5),
  ('C1', 'Completa: «De haber sabido la verdad, ___ otra decisión.»', '["tomé","habría tomado","tomaba","tome"]', 1, 6),
  ('C1', 'Completa: «El informe, ___ extensión era enorme, se leyó en una tarde.»', '["cuya","cuyo","cuyas","que"]', 0, 7),
  ('C1', 'Completa: «Son medidas ___ las que se opone la oposición.»', '["a","de","con","por"]', 0, 8),
  ('C1', 'Completa: «Cuanto más lo pienso, ___ convencido estoy.»', '["más","mucho","muy","tan"]', 0, 9),
  ('C1', 'Completa: «Lejos de ___, reconoció su error.»', '["ocultarlo","ocultar","ocultándolo","ocultó"]', 0, 10),
  -- ------------------------------- C2 -------------------------------
  ('C2', 'Completa: «No bien ___ llegado, sonó el teléfono.»', '["había","hubo","ha","habrá"]', 0, 1),
  ('C2', 'Completa: «De no ser por su ayuda, ___ fracasado.»', '["hemos","habríamos","habíamos","habremos"]', 1, 2),
  ('C2', 'Completa: «Por más que ___, no logró convencerla.»', '["se esforzó","se esforzara","se esfuerza","se esforzará"]', 1, 3),
  ('C2', 'Completa: «A fuerza de ___, consiguió lo que quería.»', '["insiste","insistir","insistió","insistiría"]', 1, 4),
  ('C2', 'Completa: «Mal que le ___, tendrá que aceptarlo.»', '["pese","pesa","pesara","pesó"]', 0, 5),
  ('C2', 'Completa: «Cabe la posibilidad ___ que haya un error.»', '["de","a","en","con"]', 0, 6),
  ('C2', 'Completa: «No es sino la propia experiencia ___ nos enseña.»', '["que","la que","quien","cual"]', 1, 7),
  ('C2', 'Completa: «Se diría ___ el tiempo se hubiera detenido.»', '["que","si","como","cuando"]', 0, 8),
  ('C2', 'Completa: «El autor se vale de la ironía ___ criticar la sociedad.»', '["para","por","a","de"]', 0, 9),
  ('C2', 'Completa: «Huelga ___ que su trabajo es excelente.»', '["decir","decirlo","diciendo","decirse"]', 0, 10);

  if not exists (select 1 from public.writing_prompts limit 1) then
    insert into public.writing_prompts (level, prompt, min_words, position) values
    ('A1', 'Escribe un texto breve sobre tu familia: quiénes son, qué hacen y cómo es un día normal con ellos.', 50, 1),
    ('A2', 'Describe tu barrio o tu ciudad. ¿Qué lugares te gustan más y por qué?', 80, 1),
    ('B1', '¿Qué harías si tuvieras un año libre? Explica tus planes y las razones de tus decisiones.', 120, 1),
    ('B2', '¿Crees que el turismo masivo beneficia o perjudica a las ciudades? Argumenta tu opinión con ejemplos.', 160, 1),
    ('C1', 'Reflexiona sobre el papel de la tecnología en las relaciones humanas: ¿nos acerca o nos aísla?', 220, 1),
    ('C2', '«La memoria es una construcción, no un archivo». ¿Estás de acuerdo con esta afirmación? Desarrolla tu postura.', 280, 1);
  end if;

  if not exists (select 1 from public.speaking_prompts limit 1) then
    insert into public.speaking_prompts (level, prompt, guidance, prep_seconds, max_seconds, position) values
    ('A1', 'Preséntate: di tu nombre, de dónde eres, qué te gusta hacer y cómo es tu familia.', 'Habla despacio y con frases cortas.', 45, 90, 1),
    ('A2', 'Cuenta cómo fue tu último viaje o unas vacaciones que recuerdes.', 'Usa el pasado y describe lugares y personas.', 60, 120, 1),
    ('B1', '¿Qué cambiarías de tu rutina diaria y por qué? Explica ventajas e inconvenientes.', 'Organiza tu respuesta en dos o tres ideas.', 60, 150, 1),
    ('B2', 'Debate: ¿deberían prohibirse los coches en el centro de las ciudades? Defiende tu posición.', 'Incluye argumentos a favor, en contra y una conclusión.', 90, 180, 1),
    ('C1', 'Analiza el impacto de las redes sociales en la opinión pública y propone posibles soluciones.', 'Usa conectores formales y ejemplos concretos.', 120, 240, 1),
    ('C2', 'Reflexiona sobre la relación entre el lenguaje y el poder: ¿cómo se usa el discurso para influir?', 'Estructura: tesis, argumentación, matices y conclusión.', 120, 300, 1);
  end if;
end $$;
