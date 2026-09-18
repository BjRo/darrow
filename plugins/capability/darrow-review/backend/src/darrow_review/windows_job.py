"""Native Windows ownership of subprocess descendants, including exited parents."""

from __future__ import annotations

import ctypes
import subprocess
from typing import cast


class BasicLimits(ctypes.Structure):
    _fields_ = [
        ("process_time", ctypes.c_int64),
        ("job_time", ctypes.c_int64),
        ("flags", ctypes.c_uint32),
        ("minimum_working_set", ctypes.c_size_t),
        ("maximum_working_set", ctypes.c_size_t),
        ("active_processes", ctypes.c_uint32),
        ("affinity", ctypes.c_size_t),
        ("priority", ctypes.c_uint32),
        ("scheduling", ctypes.c_uint32),
    ]


class ExtendedLimits(ctypes.Structure):
    _fields_ = [
        ("basic", BasicLimits),
        ("io", ctypes.c_uint64 * 6),
        ("process_memory", ctypes.c_size_t),
        ("job_memory", ctypes.c_size_t),
        ("peak_process_memory", ctypes.c_size_t),
        ("peak_job_memory", ctypes.c_size_t),
    ]


def library(name: str) -> ctypes.CDLL:
    # Imported safely on Unix; loading is restricted to the native Windows path.
    return cast(ctypes.CDLL, ctypes.__dict__["WinDLL"](name, use_last_error=True))


class WindowsJob:
    def __init__(self) -> None:
        self.kernel = library("kernel32")
        self.native = library("ntdll")
        self.kernel.CreateJobObjectW.argtypes = [ctypes.c_void_p, ctypes.c_wchar_p]
        self.kernel.CreateJobObjectW.restype = ctypes.c_void_p
        for name in ("AssignProcessToJobObject", "TerminateJobObject"):
            function = getattr(self.kernel, name)
            function.argtypes = [ctypes.c_void_p, ctypes.c_void_p]
            function.restype = ctypes.c_int
        self.kernel.TerminateJobObject.argtypes = [ctypes.c_void_p, ctypes.c_uint32]
        self.kernel.CloseHandle.argtypes = [ctypes.c_void_p]
        self.native.NtResumeProcess.argtypes = [ctypes.c_void_p]
        self.native.NtResumeProcess.restype = ctypes.c_long
        self.handle = self.kernel.CreateJobObjectW(None, None)
        if not self.handle:
            raise OSError("cannot create Windows subprocess job")
        self.kill_on_close()

    def kill_on_close(self) -> None:
        limits = ExtendedLimits()
        limits.basic.flags = 0x2000  # JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
        self.kernel.SetInformationJobObject.argtypes = [
            ctypes.c_void_p,
            ctypes.c_int,
            ctypes.c_void_p,
            ctypes.c_uint32,
        ]
        if not self.kernel.SetInformationJobObject(
            self.handle, 9, ctypes.byref(limits), ctypes.sizeof(limits)
        ):
            self.kernel.CloseHandle(self.handle)
            raise OSError("cannot configure Windows subprocess job")

    def attach(self, process: subprocess.Popen[bytes]) -> None:
        # Popen launches suspended: no descendant can escape before assignment.
        handle = int(process.__dict__["_handle"])
        try:
            if not self.kernel.AssignProcessToJobObject(self.handle, handle):
                raise OSError("cannot assign Windows subprocess job")
            if self.native.NtResumeProcess(handle) != 0:
                raise OSError("cannot resume Windows subprocess job")
        except OSError:
            process.kill()
            process.wait()
            raise

    def close(self) -> None:
        # Terminate the entire job even when its original process already exited.
        self.kernel.TerminateJobObject(self.handle, 1)
        self.kernel.CloseHandle(self.handle)
