package com.obol.salarysimulator.util;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.obol.salarysimulator.model.SalaryComponent;
import org.springframework.stereotype.Component;

import java.io.File;
import java.io.IOException;
import java.util.List;

@Component
public class SalaryComponentFileWriter {

    private static final String FILE_PATH = "src/main/resources/components.json";

    public void saveToFile(List<SalaryComponent> components) throws IOException {
        ObjectMapper mapper = new ObjectMapper();
        mapper.writerWithDefaultPrettyPrinter().writeValue(new File(FILE_PATH), components);
    }
}
