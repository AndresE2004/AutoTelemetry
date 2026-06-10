# Datos MATLAB — Suzuki Grand Vitara LS 2009

Coloca aquí (o en `C:\Users\ASUS\Desktop\Datos`) los **13 archivos `.mat`** del profesor.

## Importar todos de una vez

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python scripts\seed_demo.py
python scripts\import_all_matlab_tests.py --dir "C:\Users\ASUS\Desktop\Datos"
```

El script ordena los `.mat` **por nombre**:

| Orden | Archivo (ejemplo) | Vehículo en la app |
|-------|-------------------|---------------------|
| 1.º | (primer .mat alfabético) | GV-PRB-01 |
| 2.º | … | GV-PRB-02 |
| … | … | … |
| 13.º | … | GV-PRB-13 |

Renombra los archivos si quieres controlar el orden (`01_normal.mat`, `02_carga.mat`, …).

## Un solo archivo

```powershell
python scripts\import_matlab_mat.py --mat "C:\Users\ASUS\Desktop\Datos\primera prueba.mat" --prueba 1
```

`--prueba N` usa el UUID de GV-PRB-NN del seed (sin API: usa `import_all_matlab_tests.py` con Postgres).
