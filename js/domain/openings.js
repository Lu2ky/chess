/**
 * domain/openings.js
 * Catálogo de aperturas ECO (datos puros, sin lógica de ajedrez).
 * El índice se construye en adapters/opening-book.js, que sí puede
 * validar movimientos con el motor de reglas.
 */

export const OPENING_BOOK_SOURCE = `
B00|Apertura de Peón de Rey|e4
B00|Defensa Nimzowitsch|e4 Nc6
B00|Defensa Owen|e4 b6
B01|Defensa Escandinava|e4 d5
B01|Escandinava, Variante Moderna|e4 d5 exd5 Nf6
B01|Escandinava, Variante Principal|e4 d5 exd5 Qxd5 Nc3 Qa5
B02|Defensa Alekhine|e4 Nf6
B03|Alekhine, Ataque de Cuatro Peones|e4 Nf6 e5 Nd5 d4 d6 c4 Nb6 f4
B06|Defensa Moderna|e4 g6
B07|Defensa Pirc|e4 d6 d4 Nf6 Nc3 g6
B09|Pirc, Ataque Austriaco|e4 d6 d4 Nf6 Nc3 g6 f4
B10|Defensa Caro-Kann|e4 c6
B10|Caro-Kann, Ataque Dos Caballos|e4 c6 Nc3 d5 Nf3
B12|Caro-Kann, Variante de Avance|e4 c6 d4 d5 e5
B13|Caro-Kann, Variante de Cambio|e4 c6 d4 d5 exd5 cxd5
B14|Caro-Kann, Ataque Panov|e4 c6 d4 d5 exd5 cxd5 c4
B15|Caro-Kann, 3.Nc3|e4 c6 d4 d5 Nc3 dxe4 Nxe4
B17|Caro-Kann, Variante Steinitz|e4 c6 d4 d5 Nc3 dxe4 Nxe4 Nd7
B18|Caro-Kann, Variante Clásica|e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5
B20|Defensa Siciliana|e4 c5
B21|Siciliana, Gran Premio|e4 c5 f4
B21|Siciliana, Gambito Smith-Morra|e4 c5 d4 cxd4 c3
B22|Siciliana, Variante Alapin|e4 c5 c3
B23|Siciliana Cerrada|e4 c5 Nc3
B27|Siciliana, Dragón Acelerado|e4 c5 Nf3 g6
B28|Siciliana, Variante O'Kelly|e4 c5 Nf3 a6
B30|Siciliana, Variante Nc6|e4 c5 Nf3 Nc6
B31|Siciliana, Ataque Rossolimo|e4 c5 Nf3 Nc6 Bb5
B34|Siciliana, Dragón Acelerado (Nc6)|e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 g6
B33|Siciliana, Sveshnikov|e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5
B40|Siciliana, Variante e6|e4 c5 Nf3 e6
B41|Siciliana, Variante Kan|e4 c5 Nf3 e6 d4 cxd4 Nxd4 a6
B44|Siciliana, Variante Taimanov|e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nc6
B45|Siciliana, Cuatro Caballos|e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nf6 Nc3 Nc6
B50|Siciliana, Variante d6|e4 c5 Nf3 d6
B51|Siciliana, Variante Moscú|e4 c5 Nf3 d6 Bb5+
B54|Siciliana Abierta|e4 c5 Nf3 d6 d4 cxd4 Nxd4
B56|Siciliana Abierta, Nf6|e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3
B60|Siciliana, Richter-Rauzer|e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 Nc6 Bg5
B70|Siciliana, Variante Dragón|e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6
B76|Dragón, Ataque Yugoslavo|e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be3 Bg7 f3 O-O Qd2 Nc6
B80|Siciliana, Variante Scheveningen|e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 e6
B90|Siciliana, Variante Najdorf|e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6
B92|Najdorf, Variante Be2|e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be2
B94|Najdorf, Variante Bg5|e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Bg5
C00|Defensa Francesa|e4 e6
C01|Francesa, Variante de Cambio|e4 e6 d4 d5 exd5
C02|Francesa, Variante de Avance|e4 e6 d4 d5 e5
C03|Francesa, Variante Tarrasch|e4 e6 d4 d5 Nd2
C10|Francesa, Variante Rubinstein|e4 e6 d4 d5 Nc3 dxe4
C11|Francesa, Variante Clásica|e4 e6 d4 d5 Nc3 Nf6
C15|Francesa, Variante Winawer|e4 e6 d4 d5 Nc3 Bb4
C18|Francesa, Winawer, Variante principal|e4 e6 d4 d5 Nc3 Bb4 e5 c5 a3 Bxc3+ bxc3
C20|Apertura de Peón de Rey (1.e4 e5)|e4 e5
C21|Gambito Danés|e4 e5 d4 exd4 c3
C22|Partida del Centro|e4 e5 d4 exd4 Qxd4
C23|Apertura del Alfil|e4 e5 Bc4
C25|Apertura Vienesa|e4 e5 Nc3
C26|Vienesa, Variante Nf6|e4 e5 Nc3 Nf6
C29|Gambito Vienés|e4 e5 Nc3 Nf6 f4
C30|Gambito de Rey|e4 e5 f4
C30|Gambito de Rey Rehusado|e4 e5 f4 Bc5
C31|Contragambito Falkbeer|e4 e5 f4 d5
C33|Gambito de Rey Aceptado|e4 e5 f4 exf4
C40|Apertura del Caballo de Rey|e4 e5 Nf3
C40|Gambito Letón|e4 e5 Nf3 f5
C41|Defensa Philidor|e4 e5 Nf3 d6
C42|Defensa Petrov (Rusa)|e4 e5 Nf3 Nf6
C42|Petrov, Variante Clásica|e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4 d5 Bd3
C43|Petrov, Ataque Moderno|e4 e5 Nf3 Nf6 d4
C44|Apertura Escocesa|e4 e5 Nf3 Nc6 d4
C44|Gambito Escocés|e4 e5 Nf3 Nc6 d4 exd4 Bc4
C45|Partida Escocesa|e4 e5 Nf3 Nc6 d4 exd4 Nxd4
C45|Escocesa, Variante Mieses|e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nxc6 bxc6 e5
C46|Partida de Tres Caballos|e4 e5 Nf3 Nc6 Nc3
C46|Partida de Cuatro Caballos|e4 e5 Nf3 Nc6 Nc3 Nf6
C47|Cuatro Caballos, Variante Escocesa|e4 e5 Nf3 Nc6 Nc3 Nf6 d4 exd4 Nxd4
C48|Cuatro Caballos, Variante Española|e4 e5 Nf3 Nc6 Nc3 Nf6 Bb5
C50|Apertura Italiana|e4 e5 Nf3 Nc6 Bc4
C50|Giuoco Piano|e4 e5 Nf3 Nc6 Bc4 Bc5
C50|Giuoco Pianissimo|e4 e5 Nf3 Nc6 Bc4 Bc5 d3
C51|Gambito Evans|e4 e5 Nf3 Nc6 Bc4 Bc5 b4
C54|Giuoco Piano, Ataque Central|e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4
C55|Defensa de los Dos Caballos|e4 e5 Nf3 Nc6 Bc4 Nf6
C58|Dos Caballos, Ataque Ng5|e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Na5
C60|Apertura Española (Ruy López)|e4 e5 Nf3 Nc6 Bb5
C62|Española, Defensa Steinitz|e4 e5 Nf3 Nc6 Bb5 d6
C63|Española, Defensa Schliemann|e4 e5 Nf3 Nc6 Bb5 f5
C65|Española, Defensa Berlinesa|e4 e5 Nf3 Nc6 Bb5 Nf6
C67|Berlinesa, Muro de Berlín|e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 d4 Nd6 Bxc6 dxc6 dxe5 Nf5 Qxd8+ Kxd8
C68|Española, Variante de Cambio|e4 e5 Nf3 Nc6 Bb5 a6 Bxc6
C70|Española, Defensa Morphy|e4 e5 Nf3 Nc6 Bb5 a6 Ba4
C77|Española, Morphy Nf6|e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6
C80|Española Abierta|e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Nxe4
C84|Española Cerrada|e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7
C88|Española Cerrada, Variante principal|e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3
C89|Española, Ataque Marshall|e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 O-O c3 d5
A40|Apertura de Peón de Dama|d4
A43|Defensa Benoni Antigua|d4 c5
A45|Defensa India (d4 Nf6)|d4 Nf6
A45|Ataque Trompowsky|d4 Nf6 Bg5
A50|Defensas Indias (c4)|d4 Nf6 c4
A51|Gambito Budapest|d4 Nf6 c4 e5
A57|Gambito Benko|d4 Nf6 c4 c5 d5 b5
A60|Defensa Benoni|d4 Nf6 c4 c5 d5 e6
A80|Defensa Holandesa|d4 f5
A87|Holandesa, Variante Leningrado|d4 f5 g3 Nf6 Bg2 g6
A91|Holandesa, Muro de Piedra (Stonewall)|d4 f5 g3 Nf6 Bg2 e6 Nf3 d5
D00|Apertura de Peón de Dama (d4 d5)|d4 d5
D01|Ataque Veresov|d4 d5 Nc3 Nf6 Bg5
D02|Sistema Londres|d4 d5 Nf3 Nf6 Bf4
D04|Ataque Colle|d4 d5 Nf3 Nf6 e3
D06|Gambito de Dama|d4 d5 c4
D07|Defensa Chigorin|d4 d5 c4 Nc6
D08|Contragambito Albin|d4 d5 c4 e5
D10|Defensa Eslava|d4 d5 c4 c6
D11|Eslava, 3.Nf3|d4 d5 c4 c6 Nf3
D12|Eslava, Variante Alfil Dama|d4 d5 c4 c6 Nf3 Nf6 e3 Bf5
D15|Eslava, 4.Nc3|d4 d5 c4 c6 Nf3 Nf6 Nc3
D17|Eslava Checa|d4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4 Bf5
D20|Gambito de Dama Aceptado|d4 d5 c4 dxc4
D27|Gambito de Dama Aceptado, Variante Clásica|d4 d5 c4 dxc4 Nf3 Nf6 e3 e6 Bxc4 c5
D30|Gambito de Dama Rehusado|d4 d5 c4 e6
D35|GDR, Variante de Cambio|d4 d5 c4 e6 Nc3 Nf6 cxd5
D43|Semi-Eslava|d4 d5 c4 c6 Nf3 Nf6 Nc3 e6
D47|Semi-Eslava, Variante Merano|d4 d5 c4 c6 Nf3 Nf6 Nc3 e6 e3 Nbd7 Bd3 dxc4 Bxc4 b5
D50|GDR, Variante Clásica|d4 d5 c4 e6 Nc3 Nf6 Bg5
D52|GDR, Cambridge Springs|d4 d5 c4 e6 Nc3 Nf6 Bg5 Nbd7 e3 c6 Nf3 Qa5
D63|GDR, Defensa Ortodoxa|d4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 Nbd7
D80|Defensa Grünfeld|d4 Nf6 c4 g6 Nc3 d5
D85|Grünfeld, Variante de Cambio|d4 Nf6 c4 g6 Nc3 d5 cxd5 Nxd5 e4
E01|Apertura Catalana|d4 Nf6 c4 e6 g3
E04|Catalana Abierta|d4 Nf6 c4 e6 g3 d5 Bg2 dxc4
E06|Catalana Cerrada|d4 Nf6 c4 e6 g3 d5 Bg2 Be7 Nf3 O-O O-O
E11|Defensa Bogo-India|d4 Nf6 c4 e6 Nf3 Bb4+
E12|Defensa India de Dama|d4 Nf6 c4 e6 Nf3 b6
E15|India de Dama, Fianchetto|d4 Nf6 c4 e6 Nf3 b6 g3
E20|Defensa Nimzo-India|d4 Nf6 c4 e6 Nc3 Bb4
E32|Nimzo-India, Variante Clásica|d4 Nf6 c4 e6 Nc3 Bb4 Qc2
E40|Nimzo-India, Variante Rubinstein|d4 Nf6 c4 e6 Nc3 Bb4 e3
E60|Defensa India de Rey|d4 Nf6 c4 g6
E60|India de Rey, 3.Nc3|d4 Nf6 c4 g6 Nc3 Bg7
E76|India de Rey, Cuatro Peones|d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 f4
E81|India de Rey, Sämisch|d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 f3
E97|India de Rey, Variante Clásica|d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5
A10|Apertura Inglesa|c4
A13|Inglesa, Variante e6|c4 e6
A15|Inglesa, Anglo-India|c4 Nf6
A20|Inglesa, Siciliana Invertida|c4 e5
A30|Inglesa, Variante Simétrica|c4 c5
A04|Apertura Réti|Nf3
A07|Ataque Indio de Rey|Nf3 d5 g3
A09|Réti, Gambito de Dama|Nf3 d5 c4
A00|Apertura Bird|f4
A02|Bird, Variante d5|f4 d5
A00|Apertura Grob|g4
A00|Apertura Polaca|b4
A01|Apertura Larsen|b3
`;
