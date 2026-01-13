const API = 'http://localhost:3000/api';
let allData = []; 
let currentPage = 1;
const rowsPerPage = 5; 


window.onload = async () => {
    await cargarCombos();
    await cargarDatos();
    document.getElementById('fecha').valueAsDate = new Date();
};

async function cargarCombos() {
    try {
        const [r, u, t] = await Promise.all([
            fetch(API+'/rutas').then(res=>res.json()),
            fetch(API+'/unidades').then(res=>res.json()),
            fetch(API+'/tipos').then(res=>res.json())
        ]);
        llenarSelect('ruta', r);
        llenarSelect('unidad', u);
        llenarSelect('tipo', t);
        

        const filtro = document.getElementById('filtroRuta');
        filtro.innerHTML = '<option value="TODAS">Ver Todas las Rutas</option>';
        r.forEach(d => filtro.innerHTML += `<option value="${d[0]}">${d[1]}</option>`);
        
    } catch (e) {
        Swal.fire('Error', 'No se pudieron cargar las listas', 'error');
    }
}

function llenarSelect(id, data) {
    const s = document.getElementById(id);
    s.innerHTML = '<option value="">-- Seleccionar --</option>';
    data.forEach(d => s.innerHTML += `<option value="${d[0]}">${d[1]}</option>`);
}


async function cargarDatos() {
    try {
        const res = await fetch(API+'/pasajes');
        allData = await res.json();
        currentPage = 1; 
        renderTable();
    } catch (e) { console.error(e); }
}

function renderTable() {
    const tbody = document.getElementById('tablaBody');
    tbody.innerHTML = '';

    const filtroId = document.getElementById('filtroRuta').value;
    let datosFiltrados = allData;

    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const paginatedItems = datosFiltrados.slice(start, end);

    if (paginatedItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">No hay registros encontrados</td></tr>`;
        return;
    }

    paginatedItems.forEach((p, index) => {

        const visualId = start + index + 1;
        const dbId = p[0];

        const fecha = p[7] ? p[7].substring(0, 10) : '';


        let badgeClass = 'bg-secondary';
        if(p[3] === 'Normal') badgeClass = 'bg-primary';
        if(p[3] === 'Estudiante') badgeClass = 'bg-info';

        tbody.innerHTML += `
            <tr class="fila-animada">
                <td class="text-center fw-bold text-secondary">${visualId}</td>
                <td>
                    <div class="fw-bold text-dark">${p[5]}</div>
                    <div class="small text-muted"><i class="fa-solid fa-id-card me-1"></i>${p[4]}</div>
                </td>
                <td>
                    <div class="text-primary fw-bold">${p[1]}</div>
                    <div class="small text-muted"><i class="fa-solid fa-bus me-1"></i>${p[2]}</div>
                </td>
                <td>
                    <span class="badge ${badgeClass} badge-tipo mb-1">${p[3]}</span>
                    <div class="fw-bold text-success">$${parseFloat(p[6]).toFixed(2)}</div>
                    <div class="small text-muted">${fecha} ${p[8]}</div>
                </td>
                <td class="text-center">
                    <button onclick="prepararEdicion(${dbId})" class="btn btn-warning btn-circle shadow-sm text-white" title="Editar">
                        <i class="fa-solid fa-pencil"></i>
                    </button>
                    <button onclick="borrar(${dbId})" class="btn btn-danger btn-circle shadow-sm" title="Eliminar">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });

    renderPagination(datosFiltrados.length);
}

function renderPagination(totalItems) {
    const totalPages = Math.ceil(totalItems / rowsPerPage);
    const pagContainer = document.getElementById('paginacion');
    document.getElementById('infoPaginacion').innerText = `Mostrando ${Math.min(rowsPerPage, totalItems)} de ${totalItems} registros`;
    
    pagContainer.innerHTML = '';

    // Botón Anterior
    pagContainer.innerHTML += `
        <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="cambiarPagina(${currentPage - 1})">&laquo;</a>
        </li>
    `;

    // Números
    for (let i = 1; i <= totalPages; i++) {
        pagContainer.innerHTML += `
            <li class="page-item ${i === currentPage ? 'active' : ''}">
                <a class="page-link" href="#" onclick="cambiarPagina(${i})">${i}</a>
            </li>
        `;
    }

    // Botón Siguiente
    pagContainer.innerHTML += `
        <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="cambiarPagina(${currentPage + 1})">&raquo;</a>
        </li>
    `;
}

function cambiarPagina(pag) {
    if (pag < 1) return;
    currentPage = pag;
    renderTable();
}

// GUARDAR / EDITAR
document.getElementById('formPasaje').onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('id_pasaje').value;
    
    const data = {
        id_ruta: document.getElementById('ruta').value,
        id_unidad: document.getElementById('unidad').value,
        id_tipo: document.getElementById('tipo').value,
        cedula: document.getElementById('cedula').value,
        nombre: document.getElementById('nombre').value,
        valor: document.getElementById('valor').value,
        fecha: document.getElementById('fecha').value,
        hora: document.getElementById('hora').value,
        asiento: document.getElementById('asiento').value,
        obs: document.getElementById('obs').value
    };

    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API}/pasajes/${id}` : `${API}/pasajes`;

    try {
        const res = await fetch(url, {
            method: method,
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify(data)
        });
        
        const responseData = await res.json();

        if (res.ok) {
            Swal.fire({
                icon: 'success',
                title: id ? 'Actualizado' : 'Guardado',
                text: 'Operación realizada con éxito',
                timer: 2000,
                showConfirmButton: false
            });
            resetForm();
            cargarDatos();
        } else {
            // Manejo de errores de Oracle (Choques, Capacidad)
            let msg = responseData.error || 'Error desconocido';
            if(msg.includes('ORA-20001')) msg = '⚠️ Capacidad excedida: El asiento no existe.';
            if(msg.includes('ORA-20002')) msg = '⛔ Choque de horario: Asiento ya vendido.';
            
            Swal.fire('Error', msg, 'error');
        }
    } catch (e) {
        Swal.fire('Error', 'Fallo de conexión', 'error');
    }
};

window.prepararEdicion = (id) => {
    const p = allData.find(item => item[0] == id);
    if (!p) return;


    document.getElementById('id_pasaje').value = p[0];
    document.getElementById('cedula').value = p[4];
    document.getElementById('nombre').value = p[5];
    document.getElementById('valor').value = p[6];
    document.getElementById('fecha').value = p[7].substring(0,10);
    document.getElementById('hora').value = p[8];
    
    Swal.fire({
        icon: 'info',
        title: 'Modo Edición',
        text: 'Selecciona nuevamente la Ruta, Unidad y Tipo.',
        toast: true, position: 'top-end', showConfirmButton: false, timer: 3000
    });

    document.getElementById('formTitle').innerHTML = `<i class="fa-solid fa-pen-to-square me-2"></i>Editar Pasaje #${id}`;
    document.getElementById('btnGuardar').innerHTML = `<i class="fa-solid fa-rotate me-2"></i>Actualizar`;
    document.getElementById('btnGuardar').className = "btn btn-warning btn-lg shadow-sm text-white";
    document.getElementById('btnCancelar').style.display = 'inline-block';
};

window.resetForm = () => {
    document.getElementById('formPasaje').reset();
    document.getElementById('id_pasaje').value = '';
    document.getElementById('formTitle').innerHTML = `<i class="fa-solid fa-ticket me-2"></i>Nuevo Pasaje`;
    document.getElementById('btnGuardar').innerHTML = `<i class="fa-solid fa-save me-2"></i>Guardar`;
    document.getElementById('btnGuardar').className = "btn btn-primary btn-lg shadow-sm";
    document.getElementById('btnCancelar').style.display = 'none';
    document.getElementById('fecha').valueAsDate = new Date();
};

window.borrar = async (id) => {
    const result = await Swal.fire({
        title: '¿Estás seguro?',
        text: "No podrás revertir esto",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, eliminar'
    });

    if (result.isConfirmed) {
        await fetch(`${API}/pasajes/${id}`, { method: 'DELETE' });
        cargarDatos();
        Swal.fire('Eliminado', 'El registro ha sido eliminado.', 'success');
    }
};

window.aplicarFiltro = async () => {
    const id = document.getElementById('filtroRuta').value;
    if (id === 'TODAS') {
        cargarDatos();
    } else {
        const res = await fetch(`${API}/pasajes/ruta/${id}`);
        allData = await res.json();
        currentPage = 1;
        renderTable();
    }
};

window.exportarCSV = async () => {
    Swal.fire({title: 'Generando reporte...', didOpen: () => Swal.showLoading()});
    const res = await fetch(API+'/exportar', { method: 'POST' });
    if(res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'Reporte.csv'; a.click();
        Swal.close();
        Swal.fire('Éxito', 'Reporte descargado', 'success');
    } else {
        Swal.fire('Error', 'No se pudo generar el archivo', 'error');
    }
};