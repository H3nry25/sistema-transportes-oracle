require('dotenv').config();
const express = require('express');
const oracledb = require('oracledb');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

app.use(express.json());
app.use(cors());
app.use(express.static('public')); 

oracledb.autoCommit = true; 

const dbConfig = { 
    user: process.env.DB_USER, 
    password: process.env.DB_PASSWORD, 
    connectString: process.env.DB_STRING 
};


app.get('/api/pasajes', async (req, res) => {
    let conn;
    try {
        conn = await oracledb.getConnection(dbConfig);
        
        const result = await conn.execute(
            `BEGIN SPU_CONSULTAR_PASAJES(:c); END;`,
            { c: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT } }
        );

        const resultSet = result.outBinds.c;
        const rows = await resultSet.getRows(); 
        await resultSet.close();
        
        res.json(rows);
    } catch (e) {
        console.error("Error al consultar:", e);
        res.status(500).json({ error: e.message });
    } finally {
        if (conn) await conn.close();
    }
});


app.get('/api/pasajes/ruta/:id', async (req, res) => {
    let conn;
    try {
        conn = await oracledb.getConnection(dbConfig);
        const result = await conn.execute(
            `BEGIN SPU_CONSULTAR_PASAJES_POR_RUTA(:id, NULL, NULL, :c); END;`,
            { 
                id: req.params.id,
                c: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT } 
            }
        );
        const rows = await result.outBinds.c.getRows();
        await result.outBinds.c.close();
        res.json(rows);
    } catch (e) {
        console.error("Error al filtrar:", e);
        res.status(500).json({ error: e.message });
    } finally {
        if (conn) await conn.close();
    }
});


app.post('/api/pasajes', async (req, res) => {
    let conn;
    try {

        const { id_ruta, id_unidad, id_tipo, cedula, nombre, valor, fecha, hora, asiento, obs } = req.body;
        
        console.log("Intentando insertar:", req.body); 

        conn = await oracledb.getConnection(dbConfig);
        const result = await conn.execute(
            `BEGIN 
                SPU_INSERTAR_PASAJE(
                    :r, :u, :t, 
                    :ced, :nom,     -- Nuevos campos de Cliente
                    :v, TO_DATE(:f,'YYYY-MM-DD'), :h, 
                    :a, :o, 
                    :id_salida      -- ID que nos devuelve Oracle
                ); 
             END;`,
            {
                r: id_ruta, u: id_unidad, t: id_tipo,
                ced: cedula, nom: nombre,
                v: valor, f: fecha, h: hora, a: asiento, o: obs,
                id_salida: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
            }
        );

        console.log("Insertado con éxito ID:", result.outBinds.id_salida);
        res.json({ message: 'Guardado correctamente', id: result.outBinds.id_salida });

    } catch (e) {
        console.error("Error al insertar:", e.message);
        res.status(500).json({ error: e.message });
    } finally {
        if (conn) await conn.close();
    }
});


app.put('/api/pasajes/:id', async (req, res) => {
    let conn;
    try {
        const { id_ruta, id_unidad, id_tipo, cedula, nombre, valor, fecha, hora, asiento, obs } = req.body;
        const idPasaje = req.params.id; 

        console.log(`Intentando actualizar ID ${idPasaje} con:`, req.body);

        conn = await oracledb.getConnection(dbConfig);
        await conn.execute(
            `BEGIN 
                SPU_ACTUALIZAR_PASAJE(
                    :id, 
                    :r, :u, :t, 
                    :ced, :nom, 
                    :v, TO_DATE(:f,'YYYY-MM-DD'), :h, 
                    :a, :o
                ); 
             END;`,
            {
                id: idPasaje,
                r: id_ruta, u: id_unidad, t: id_tipo,
                ced: cedula, nom: nombre,
                v: valor, f: fecha, h: hora, a: asiento, o: obs
            }
        );

        console.log("Actualizado con éxito");
        res.json({ message: 'Actualizado correctamente' });

    } catch (e) {
        console.error("Error al actualizar:", e.message);
        res.status(500).json({ error: e.message });
    } finally {
        if (conn) await conn.close();
    }
});

app.delete('/api/pasajes/:id', async (req, res) => {
    let conn;
    try {
        conn = await oracledb.getConnection(dbConfig);
        await conn.execute(
            `BEGIN SPU_ELIMINAR_PASAJE(:id); END;`, 
            { id: req.params.id }
        );
        res.json({ message: 'Eliminado correctamente' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    } finally {
        if (conn) await conn.close();
    }
});

app.post('/api/exportar', async (req, res) => {
    let conn;
    try {
        const nombreArchivo = `Reporte_${Date.now()}.csv`;
        
        conn = await oracledb.getConnection(dbConfig);
        await conn.execute(
            `BEGIN SPU_EXPORTAR_PASAJES_CSV(:n); END;`, 
            { n: nombreArchivo }
        );
        const rutaCompleta = path.join(process.env.CSV_EXPORT_PATH, nombreArchivo);
        
        if (fs.existsSync(rutaCompleta)) {
            res.download(rutaCompleta, nombreArchivo);
        } else {
            res.status(404).json({ error: 'El archivo no se generó en la ruta esperada.' });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    } finally {
        if (conn) await conn.close();
    }
});

async function getLista(procedure, res) {
    let conn;
    try {
        conn = await oracledb.getConnection(dbConfig);
        const r = await conn.execute(
            `BEGIN ${procedure}(:c); END;`, 
            { c: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT } }
        );
        const rows = await r.outBinds.c.getRows();
        await r.outBinds.c.close();
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    } finally {
        if (conn) await conn.close();
    }
}

app.get('/api/rutas', (req, res) => getLista('SPU_LISTAR_RUTAS', res));
app.get('/api/unidades', (req, res) => getLista('SPU_LISTAR_UNIDADES', res));
app.get('/api/tipos', (req, res) => getLista('SPU_LISTAR_TIPOS_PASAJE', res));


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor listo en http://localhost:${PORT}`);
});